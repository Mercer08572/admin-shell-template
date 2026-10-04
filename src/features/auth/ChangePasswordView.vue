<script setup lang="ts">
import { KeyRound } from '@lucide/vue'
import { type FormInst, type FormItemRule, type FormRules, useMessage } from 'naive-ui'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getErrorMessage } from '@/api/error'
import PageHeader from '@/components/common/PageHeader.vue'
import { useAuthStore } from '@/features/auth/auth.store'

interface PasswordForm {
  currentPassword: string
  newPassword: string
  confirmation: string
}

const auth = useAuthStore()
const router = useRouter()
const message = useMessage()
const formRef = ref<FormInst | null>(null)
const submitting = ref(false)
const form = reactive<PasswordForm>({ currentPassword: '', newPassword: '', confirmation: '' })

function validateConfirmation(_rule: FormItemRule, value: string) {
  return value === form.newPassword ? true : new Error('两次输入的密码不一致')
}

const rules: FormRules = {
  currentPassword: { required: true, message: '请输入当前密码', trigger: ['input', 'blur'] },
  newPassword: [
    { required: true, message: '请输入新密码', trigger: ['input', 'blur'] },
    { min: 12, message: '新密码至少需要 12 个字符', trigger: ['input', 'blur'] },
  ],
  confirmation: [
    { required: true, message: '请再次输入新密码', trigger: ['input', 'blur'] },
    { validator: validateConfirmation, trigger: ['input', 'blur'] },
  ],
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    await auth.changePassword({
      current_password: form.currentPassword,
      new_password: form.newPassword,
    })
    message.success('密码已更新')
    await router.replace({ name: 'dashboard' })
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="page password-page">
    <PageHeader title="修改密码" />
    <section class="password-panel panel">
      <div class="password-panel__icon"><KeyRound :size="22" /></div>
      <NForm
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="top"
        @submit.prevent="submit"
      >
        <NFormItem label="当前密码" path="currentPassword">
          <NInput v-model:value="form.currentPassword" type="password" show-password-on="click" />
        </NFormItem>
        <NFormItem label="新密码" path="newPassword">
          <NInput v-model:value="form.newPassword" type="password" show-password-on="click" />
        </NFormItem>
        <NFormItem label="确认新密码" path="confirmation">
          <NInput v-model:value="form.confirmation" type="password" show-password-on="click" />
        </NFormItem>
        <NButton type="primary" attr-type="submit" :loading="submitting">保存新密码</NButton>
      </NForm>
    </section>
  </main>
</template>

<style scoped>
.password-panel {
  width: min(100%, 560px);
  padding: 28px;
}

.password-panel__icon {
  display: grid;
  width: 42px;
  height: 42px;
  margin-bottom: 22px;
  place-items: center;
  border-radius: 8px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
}
</style>
