<template>
  <div>
    <t-row class="operate__row" align="center" justify="space-between">
      <t-col>
        <t-button @click="onAddRow">新增</t-button>
        <t-button
          @click="onExportRules"
          variant="outline"
          style="margin-left: 8px"
          >导出规则</t-button
        >
        <t-button
          @click="onImportRules"
          variant="outline"
          style="margin-left: 8px"
          >导入规则</t-button
        >
      </t-col>
      <t-col class="col--center">
        自动同步&nbsp;&nbsp;
        <t-switch v-model="isOpenSync" size="medium" :label="['开', '关']" />
      </t-col>
    </t-row>
    <br />
    <t-table
      ref="tableRef"
      row-key="id"
      :columns="columns"
      :data="data"
      bordered
      lazy-load
      :expanded-row-keys="expandedRowKeys"
      :expanded-row="expandedRow"
      :expand-icon="expandIcon"
      @expand-change="rehandleExpandChange"
      :expandOnRowClick="false"
    />
  </div>
</template>

<script setup lang="jsx">
import { ref, computed, watch, onMounted } from "vue";
import { Input, MessagePlugin } from "tdesign-vue-next";
import { LIST_KEY } from "./type";
import { isEmpty, cloneDeep } from "lodash-es";
import useStorage from "./hooks/useStorage";

const expandIcon = ref(true);
const expandedRowKeys = ref([]);
const isOpenSync = ref(true);

const defaultData = {
  id: "",
  from: "localhost",
  to: "localhost",
  cookies: [{ name: "cookie" }],
};
const align = ref("left");
const data = ref([]);
const tableRef = ref();

const { updateStorage, getStorage, updateCookie, updateStorageObj } =
  useStorage();

onMounted(async () => {
  // 并行加载数据，减少等待时间
  const [openSyncLocal, storage] = await Promise.all([
    getStorage("isOpenSync"),
    getStorage(LIST_KEY),
  ]);

  isOpenSync.value = isEmpty(openSyncLocal) ? true : openSyncLocal.isOpenSync;

  if (isEmpty(openSyncLocal)) {
    updateStorageObj({ isOpenSync: isOpenSync.value });
  }

  const domainList = isEmpty(storage) ? [] : Object.values(storage[LIST_KEY]);

  if (!isEmpty(domainList)) {
    data.value = domainList;
    // 延迟处理cookie更新，避免阻塞界面渲染
    setTimeout(() => {
      data.value.forEach((item) => {
        item.cookies = Object.values(item.cookies);
        updateCookie(item);
      });
    }, 100);
  }
});

watch(isOpenSync, () => updateStorageObj({ isOpenSync: isOpenSync.value }));

const expandedRow = (h, { row }) => (
  <div class="more-detail">
    <div class="cookie-operate-row">
      <t-button
        theme="primary"
        size="small"
        data-row-id={row.id}
        onClick={onAddCookie}
      >
        添加Cookie
      </t-button>
    </div>
    {row.cookies?.map((cookie, index) => (
      <div class="cookie-row">
        <t-input
          value={cookie.name}
          v-model={cookie.name}
          onBlur="updateStorage(data.value)"
          placeholder="请输入源地址"
        />
        <t-popconfirm
          content="确认删除吗"
          onConfirm={() => onCookieAction(row.id, index, "delete")}
        >
          <t-link class="cookie__btn--delete" theme="primary" hover="color">
            删除
          </t-link>
        </t-popconfirm>
      </div>
    ))}
  </div>
);

const rehandleExpandChange = (value) => {
  expandedRowKeys.value = value;
};

const onAddRow = async () => {
  if (!(await validateTableData())) return;

  const maxId =
    data.value.length > 0
      ? Math.max(...data.value.map((item) => Number(item.id)))
      : 0;
  data.value.push({ ...cloneDeep(defaultData), id: (maxId + 1).toString() });
  await updateStorage(data.value);
};

const onCookieAction = (rowId, index, action) => {
  const item = data.value.find((item) => item.id === rowId);
  if (action === "delete") {
    item.cookies.splice(index, 1);
  } else {
    item.cookies.push({ name: "cookie" });
  }
  updateStorage(data.value);
};

const onAddCookie = (e) =>
  onCookieAction(e.currentTarget.dataset.rowId, null, "add");

const validateTableData = async () => {
  const result = await tableRef.value.validateTableData();
  if (result.result.length) {
    const r = result.result[0];
    MessagePlugin.error(`${r.col.title} ${r.errorList[0].message}`);
    return false;
  }
  return true;
};

const onUpdate = async (e) => {
  const item = data.value.find(
    (item) => item.id === e.currentTarget.dataset.id
  );
  await updateCookie(item);
  MessagePlugin.success("更新成功");
};

const onDelete = (id) => {
  data.value.splice(
    data.value.findIndex((item) => item.id === id),
    1
  );
  updateStorage(data.value);
};

const onInputEdited = (context) => {
  data.value.splice(context.rowIndex, 1, cloneDeep(context.newRowData));
  MessagePlugin.success("Success");
  updateStorage(data.value);
};

// 导出规则功能
const onExportRules = async () => {
  try {
    if (data.value.length === 0) {
      MessagePlugin.warning("没有规则数据可导出");
      return;
    }

    // 准备导出的数据
    const exportData = {
      version: "1.0",
      exportTime: new Date().toISOString(),
      rules: data.value.map((rule) => ({
        id: rule.id,
        from: rule.from,
        to: rule.to,
        cookies: rule.cookies.map((cookie) => ({
          name: cookie.name,
        })),
      })),
    };

    // 创建下载链接
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    // 创建下载链接并触发下载
    const link = document.createElement("a");
    link.href = url;
    link.download = `cookie-sync-rules-${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    MessagePlugin.success(`成功导出 ${exportData.rules.length} 条规则`);
  } catch (error) {
    console.error("导出失败:", error);
    MessagePlugin.error("导出规则失败");
  }
};

// 导入规则功能
const onImportRules = () => {
  try {
    // 创建文件输入元素
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.style.display = "none";

    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const fileContent = await readFileAsText(file);
        const importData = JSON.parse(fileContent);

        // 验证导入数据格式
        if (!validateImportData(importData)) {
          MessagePlugin.error("导入文件格式不正确");
          return;
        }

        // 确认是否覆盖现有数据
        const confirmMessage =
          data.value.length > 0
            ? `导入后将覆盖现有的 ${data.value.length} 条规则，是否继续？`
            : "确认导入规则数据？";

        const confirmResult = await MessagePlugin.confirm(
          confirmMessage,
          "导入确认"
        );
        if (confirmResult === "cancel") return;

        // 处理导入数据
        const processedRules = processImportData(importData.rules);

        // 更新数据
        data.value = processedRules;
        await updateStorage(data.value);

        MessagePlugin.success(`成功导入 ${processedRules.length} 条规则`);
      } catch (error) {
        console.error("导入失败:", error);
        MessagePlugin.error("导入规则失败，请检查文件格式");
      }

      // 清理文件输入
      document.body.removeChild(input);
    };

    document.body.appendChild(input);
    input.click();
  } catch (error) {
    console.error("导入功能初始化失败:", error);
    MessagePlugin.error("导入功能初始化失败");
  }
};

// 读取文件为文本
const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

// 验证导入数据格式
const validateImportData = (data) => {
  if (!data || typeof data !== "object") return false;
  if (!data.rules || !Array.isArray(data.rules)) return false;

  return data.rules.every(
    (rule) =>
      rule &&
      typeof rule === "object" &&
      rule.from &&
      typeof rule.from === "string" &&
      rule.to &&
      typeof rule.to === "string" &&
      rule.cookies &&
      Array.isArray(rule.cookies)
  );
};

// 处理导入数据
const processImportData = (rules) => {
  const maxId =
    data.value.length > 0
      ? Math.max(...data.value.map((item) => Number(item.id)))
      : 0;

  return rules.map((rule, index) => ({
    id: (maxId + index + 1).toString(),
    from: rule.from,
    to: rule.to,
    cookies: rule.cookies.map((cookie) => ({
      name: cookie.name || "cookie",
    })),
  }));
};

const columns = computed(() => [
  {
    title: "源地址",
    colKey: "from",
    align: align.value,
    edit: {
      component: Input,
      props: { clearable: true, autofocus: true },
      validateTrigger: "change",
      abortEditOnEvent: ["onEnter"],
      onEdited: onInputEdited,
      rules: [{ required: true, message: "源地址不能为空" }],
      defaultEditable: false,
    },
  },
  {
    title: "目标地址",
    colKey: "to",
    align: align.value,
    edit: {
      component: Input,
      props: { clearable: true, autofocus: true },
      validateTrigger: "change",
      abortEditOnEvent: ["onEnter"],
      onEdited: onInputEdited,
      rules: [{ required: true, message: "目标地址不能为空" }],
      defaultEditable: false,
    },
  },
  {
    title: "操作栏",
    colKey: "operate",
    width: 100,
    cell: (h, { row }) => (
      <div class="table-operations">
        <t-link
          theme="primary"
          hover="color"
          data-id={row.id}
          onClick={onUpdate}
        >
          更新
        </t-link>
        &nbsp;&nbsp;
        <t-popconfirm content="确认删除吗" onConfirm={() => onDelete(row.id)}>
          <t-link theme="primary" hover="color">
            删除
          </t-link>
        </t-popconfirm>
      </div>
    ),
  },
]);
</script>
<style>
body {
  min-width: 800px;
  min-height: 500px;
}
.operate__row {
  padding: 0 10px;
}
.col--center {
  display: flex;
  align-items: center;
}
.cookie-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 5px;
}
.cookie__btn--delete {
  min-width: 40px;
  flex-basis: 40px;
  text-align: center;
  margin-left: 10px;
}
.cookie-operate-row {
  margin-bottom: 10px;
}
</style>
