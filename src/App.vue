<template>
  <div>
    <!-- 示例代码有效，勿删 -->
    <t-row class="operate__row" align="center" justify="space-between">
      <t-col>
        <t-button @click="onAddRow">新增</t-button>
      </t-col>
      <t-col class="col--center">
        自动同步&nbsp;&nbsp;
        <t-switch v-model="isOpenSync" size="medium" :label="['开', '关']">
        </t-switch>
      </t-col>
    </t-row>
    <br />
    <!-- 当前示例包含：输入框、单选、多选、日期 等场景 -->
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
import { ref, computed, watch, unref, onMounted } from "vue";
import { Input, MessagePlugin } from "tdesign-vue-next";
import { LIST_KEY } from "./type";
import { isEmpty, cloneDeep } from "lodash-es";
import useStorage from "./hooks/useStorage";

const expandIcon = ref(true);
const expandedRowKeys = ref([]);
const isOpenSync = ref(true);

// 取出缓存中的数据，回填至页面

const defaultData = {
  id: "",
  from: "localhost",
  to: "localhost",
  cookies: [{ name: "cookie" }],
};
const align = ref("left");
const data = ref([]);
const tableRef = ref();

const { updateStorage, getStorage, updateCookie } = useStorage();

onMounted(async () => {
  // 初始化开启同步状态
  const openSyncLocal = await getStorage("isOpenSync");

  if (!isEmpty(openSyncLocal)) {
    isOpenSync.value = openSyncLocal.isOpenSync;
  }

  // 从 localStorage 初始化数据
  const storage = await getStorage(LIST_KEY);
  const domainList = !isEmpty(storage) ? Object.values(storage[LIST_KEY]) : [];

  if (!isEmpty(domainList)) {
    data.value = domainList;
  }

  // 更新 localStorage 和 cookie
  if (!isEmpty(unref(data))) {
    // updateStorage(data.value);

    data.value &&
      data.value.forEach((item) => {
        // 重置cookies数组
        item.cookies = Object.keys(item.cookies).map(
          (key) => item.cookies[key]
        );
        updateCookie(item);
      });
  }
});

watch(isOpenSync, async () => {
  await chrome.storage.local.set({ isOpenSync: isOpenSync.value });
});

/**
 * 展开行
 * @param h
 * @param param1
 */
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
    {Array.isArray(row.cookies)
      ? row.cookies.map((cookie, index) => (
          <div class="cookie-row">
            <t-input
              value={cookie.name}
              v-model={cookie.name}
              onBlur={onCookieInputBlur}
              placeholder="请输入源地址"
            />
            <t-popconfirm
              content="确认删除吗"
              onConfirm={() => onDeleteCookie(row.id, index)}
            >
              <t-link class="cookie__btn--delete" theme="primary" hover="color">
                删除
              </t-link>
            </t-popconfirm>
          </div>
        ))
      : null}
  </div>
);

const rehandleExpandChange = (value, params) => {
  expandedRowKeys.value = value;
  console.log("rehandleExpandChange", value, params);
};

/**
 * 添加域名行
 */
const onAddRow = async () => {
  // 校验数据
  const success = await validateTableData();
  if (!success) {
    return;
  }

  const maxId =
    data.value.length > 0
      ? Math.max(...data.value.map((item) => Number(item.id)))
      : 0;

  const addDataId = (maxId + 1).toString();
  data.value.push({
    ...cloneDeep(defaultData),
    id: addDataId,
  });
  // 更新 localStorage 和 cookie
  await updateStorage(data.value);
};

/**
 *  cookie 编辑完成后触发
 */
const onCookieInputBlur = (value) => {
  // 更新storage
  updateStorage(data.value);
};
/**
 * 添加cookie
 */
const onAddCookie = (e) => {
  const { rowId } = e.currentTarget.dataset;
  const item = data.value.find((item) => item.id === rowId);
  item.cookies.push({
    name: "cookie",
  });
  updateStorage(data.value);
};

/**
 * 添加cookie
 */
const onDeleteCookie = (rowId, index) => {
  const item = data.value.find((item) => item.id === rowId);
  item.cookies.splice(index, 1);
  updateStorage(data.value);
};

// 用于提交前校验数据（示例代码有效，勿删）
const validateTableData = async () => {
  // 仅校验处于编辑态的单元格
  const result = await tableRef.value.validateTableData();
  console.log("validate result: ", result);
  if (result.result.length) {
    const r = result.result[0];
    MessagePlugin.error(`${r.col.title} ${r.errorList[0].message}`);
    return false;
  }
  return true;
};

/**
 * 更新cookie，刷新后台
 */
const onUpdate = async (e) => {
  const { id } = e.currentTarget.dataset;
  const item = data.value.find((item) => item.id === id);
  console.log("onUpdate", e, id, item);
  await updateCookie(item);
  MessagePlugin.success("更新成功");
};

/**
 * 删除当前配置
 * @param e
 */
const onDelete = (id) => {
  const index = data.value.findIndex((item) => item.id === id);
  data.value.splice(index, 1);
  updateStorage(data.value);
};

/**
 *
 * @param context 编辑完成后触发
 */
const onInputEdited = (context) => {
  const newData = [...data.value];
  newData.splice(context.rowIndex, 1, cloneDeep(context.newRowData));
  data.value = newData;
  console.log("Edit from:", context);
  MessagePlugin.success("Success");
  // 更新storage
  updateStorage(data.value);
};

const columns = computed(() => [
  {
    title: "源地址",
    colKey: "from",
    align: align.value,
    // 编辑状态相关配置，全部集中在 edit
    edit: {
      // 1. 支持任意组件。需保证组件包含 `value` 和 `onChange` 两个属性，且 onChange 的第一个参数值为 new value。
      // 2. 如果希望支持校验，组件还需包含 `status` 和 `tips` 属性。具体 API 含义参考 Input 组件
      component: Input,
      // props, 透传全部属性到 Input 组件。可以是一个函数，不同行有不同的 props 属性 时，使用 Function）
      props: {
        clearable: true,
        autofocus: true,
      },
      // 触发校验的时机（when to validate)
      validateTrigger: "change",
      // 透传给 component: Input 的事件（也可以在 edit.props 中添加）
      // on: (editContext) => ({
      //   onBlur: () => {
      //     console.log("失去焦点", editContext);
      //   },
      //   onEnter: (ctx) => {
      //     ctx?.e?.preventDefault();
      //     console.log("onEnter", ctx);
      //   },
      // }),
      // 除了点击非自身元素退出编辑态之外，还有哪些事件退出编辑态
      abortEditOnEvent: ["onEnter"],
      // 编辑完成，退出编辑态后触发
      onEdited: onInputEdited,
      // 校验规则，此处同 Form 表单。https://tdesign.tencent.com/vue-next/components/form
      rules: [{ required: true, message: "源地址不能为空" }],
      // 默认是否为编辑状态
      defaultEditable: false,
    },
  },
  {
    title: "目标地址",
    colKey: "to",
    align: align.value,
    // 编辑状态相关配置，全部集中在 edit
    edit: {
      // 1. 支持任意组件。需保证组件包含 `value` 和 `onChange` 两个属性，且 onChange 的第一个参数值为 new value。
      // 2. 如果希望支持校验，组件还需包含 `status` 和 `tips` 属性。具体 API 含义参考 Input 组件
      component: Input,
      // props, 透传全部属性到 Input 组件。可以是一个函数，不同行有不同的 props 属性 时，使用 Function）
      props: {
        clearable: true,
        autofocus: true,
      },
      // 触发校验的时机（when to validate)
      validateTrigger: "change",
      // 除了点击非自身元素退出编辑态之外，还有哪些事件退出编辑态
      abortEditOnEvent: ["onEnter"],
      // 编辑完成，退出编辑态后触发
      onEdited: onInputEdited,
      // 校验规则，此处同 Form 表单。https://tdesign.tencent.com/vue-next/components/form
      rules: [{ required: true, message: "目标地址不能为空" }],
      // 默认是否为编辑状态
      defaultEditable: false,
    },
  },
  {
    title: "操作栏",
    colKey: "operate",
    width: 100,
    cell: (h, { row }) => {
      return (
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
      );
    },
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
