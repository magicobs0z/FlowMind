export const collaborationSkillPrompt = `## Collaboration Skill 使用规范

**Skill ID**: \`skill_collaboration\`
**用途**: 智能体之间的标准化协作交互
**重要性**: ⭐⭐⭐ 所有智能体间通信**必须**通过此 Skill，严禁使用非标准方式传递信息

### 支持的操作

#### 1. send_message - 发送点对点消息
**用途**: 向指定智能体发送信息、反馈或请求
**必需参数**:
- \`action\`: "send_message"
- \`fromAgent\`: 发送方智能体 ID
- \`toAgent\`: 接收方智能体 ID
- \`message\`: 消息内容

**可选参数**:
- \`payload\`: 附加数据（对象）
- \`tag\`: 消息标签，用于分类

**示例**:
\`\`\`json
{
  "action": "send_message",
  "fromAgent": "agent_frontend_engineer",
  "toAgent": "agent_backend_engineer",
  "message": "登录接口的响应格式需要调整，请确认字段命名",
  "payload": { "requiredFields": ["token", "userId", "expiresAt"] },
  "tag": "[COLLAB:API_SYNC]"
}
\`\`\`

#### 2. assign_task - 分配任务
**用途**: 将任务分配给指定智能体
**必需参数**:
- \`action\`: "assign_task"
- \`fromAgent\`: 任务分配方 ID
- \`toAgent\`: 任务接收方 ID
- \`payload\`: 任务详情对象，包含:
  - \`taskId\`: 任务唯一标识
  - \`description\`: 任务描述
  - \`priority\`: 优先级（low/medium/high/urgent）
  - \`deadline\`: 截止日期（ISO 格式，可选）
  - \`dependencies\`: 依赖任务 ID 列表（可选）

**可选参数**:
- \`tag\`: 默认 "[COLLAB:ASSIGN]"

**示例**:
\`\`\`json
{
  "action": "assign_task",
  "fromAgent": "agent_project_manager",
  "toAgent": "agent_frontend_engineer",
  "payload": {
    "taskId": "task_login_ui",
    "description": "实现用户登录页面，包含表单验证和错误提示",
    "priority": "high",
    "deadline": "2024-06-15T18:00:00Z",
    "dependencies": ["task_api_login"]
  },
  "tag": "[COLLAB:ASSIGN]"
}
\`\`\`

#### 3. request_info - 请求信息
**用途**: 向其他智能体请求所需信息
**必需参数**:
- \`action\`: "request_info"
- \`fromAgent\`: 请求方 ID
- \`toAgent\`: 被请求方 ID
- \`message\`: 具体请求内容

**可选参数**:
- \`tag\`: 默认 "[COLLAB:ASK]"

**示例**:
\`\`\`json
{
  "action": "request_info",
  "fromAgent": "agent_tester",
  "toAgent": "agent_product_manager",
  "message": "请确认登录功能的边界情况：密码错误次数限制是多少？",
  "tag": "[COLLAB:ASK]"
}
\`\`\`

#### 4. notify_status - 状态通知
**用途**: 通知状态变更或进度更新
**必需参数**:
- \`action\`: "notify_status"
- \`fromAgent\`: 通知方 ID
- \`payload\`: 状态对象，包含:
  - \`status\`: 状态值（idle/busy/completed/failed/blocked）
  - \`progress\`: 进度百分比（0-100，可选）
  - \`message\`: 状态说明（可选）

**可选参数**:
- \`toAgent\`: 指定接收方（不指定则广播给相关方）
- \`tag\`: 自定义标签

**示例**:
\`\`\`json
{
  "action": "notify_status",
  "fromAgent": "agent_frontend_engineer",
  "toAgent": "agent_project_manager",
  "payload": {
    "status": "completed",
    "progress": 100,
    "message": "登录页面开发完成，已提交代码审查"
  },
  "tag": "[COLLAB:STATUS]"
}
\`\`\`

#### 5. broadcast - 广播消息
**用途**: 向多个智能体广播信息
**必需参数**:
- \`action\`: "broadcast"
- \`fromAgent\`: 广播方 ID
- \`message\`: 广播内容

**可选参数**:
- \`payload\`: 附加数据
- \`tag\`: 自定义标签

**示例**:
\`\`\`json
{
  "action": "broadcast",
  "fromAgent": "agent_project_manager",
  "message": "项目里程碑更新：v1.0.0 版本计划延期至 6 月 20 日",
  "payload": { "newDeadline": "2024-06-20", "reason": "需求变更" },
  "tag": "[COLLAB:BROADCAST]"
}
\`\`\`

### 标准消息标签规范

| 标签 | 用途 | 使用场景 |
|------|------|----------|
| [COLLAB:ASSIGN] | 任务分配 | 项目经理 → 工程师 |
| [COLLAB:ASK] | 信息请求 | 任何 → 任何 |
| [COLLAB:STATUS] | 状态更新 | 任何 → 项目经理 |
| [COLLAB:REVIEW] | 提交评审 | 工程师 → 审查员 |
| [COLLAB:BLOCKER] | 阻塞问题 | 任何 → 项目经理/用户 |
| [COLLAB:BUG] | Bug 报告 | 测试 → 工程师 |
| [COLLAB:API_SYNC] | API 同步 | 前端 ↔ 后端 |
| [COLLAB:BROADCAST] | 广播通知 | 项目经理 → 全员 |
| [COLLAB:PASS] | 审查通过 | 审查员 → 工程师 |
| [COLLAB:FAIL] | 审查未通过 | 审查员 → 工程师 |

### 协作流程规范

#### 任务分配流程
1. 项目经理使用 \`assign_task\` 分配任务
2. 接收方收到后使用 \`notify_status\` 确认接收（status: busy）
3. 执行过程中定期使用 \`notify_status\` 更新进度
4. 完成后使用 \`notify_status\`（status: completed）并附上成果

#### 代码审查流程
1. 工程师完成后使用 \`send_message\` + [COLLAB:REVIEW] 提交审查
2. 审查员使用 \`send_message\` 反馈审查意见
3. 如需修改，工程师修改后再次提交
4. 通过后审查员使用 \`send_message\` + [COLLAB:PASS]

#### 问题升级流程
1. 智能体遇到无法解决的问题
2. 使用 \`send_message\` + [COLLAB:BLOCKER] 通知项目经理
3. 项目经理协调资源或升级给用户
4. 解决后使用 \`notify_status\` 恢复工作

### 响应时效规范

| 消息类型 | 期望响应时间 | 超时处理 |
|----------|-------------|----------|
| 任务分配 | 5 分钟内确认 | 自动提醒 |
| 信息请求 | 10 分钟内回复 | 升级给项目经理 |
| 阻塞问题 | 立即响应 | 通知用户 |
| 状态更新 | 无需响应 | - |
| 广播消息 | 无需响应 | - |

### 消息内容规范

1. **清晰简洁**: 一句话说明核心诉求
2. **上下文完整**: 包含必要的背景信息
3. **可执行**: 接收方知道下一步该做什么
4. **专业礼貌**: 使用尊重的协作语言

**好的消息示例**:
> [COLLAB:ASK] 后端工程师你好，登录接口 /api/auth/login 的响应中 token 字段的过期时间格式是 Unix 时间戳还是 ISO 字符串？前端需要统一处理。请确认，谢谢！

**差的消息示例**:
> 那个接口格式是啥？
`
