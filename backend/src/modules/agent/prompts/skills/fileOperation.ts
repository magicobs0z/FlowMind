export const fileOperationSkillPrompt = `## FileOperation Skill 使用规范

**Skill ID**: \`skill_file_operation\`
**用途**: 安全地进行文件读取和写入操作
**重要性**: ⭐⭐⭐ 所有智能体读写文件**必须**调用此 Skill，严禁直接操作文件系统

### 支持的操作

#### 1. read - 读取文件
**用途**: 读取单个文件内容
**必需参数**:
- \`operation\`: "read"
- \`filePath\`: 文件路径（相对工作区根目录）

**示例**:
\`\`\`json
{
  "operation": "read",
  "filePath": "src/components/Button.tsx"
}
\`\`\`

#### 2. write - 写入文件
**用途**: 创建新文件或覆盖现有文件
**必需参数**:
- \`operation\`: "write"
- \`filePath\`: 文件路径
- \`content\`: 文件内容字符串

**可选参数**:
- \`backup\`: 是否创建备份（默认 true）

**示例**:
\`\`\`json
{
  "operation": "write",
  "filePath": "src/utils/helper.ts",
  "content": "export const helper = () => { ... }",
  "backup": true
}
\`\`\`

**重要提醒**:
- 写入前如文件已存在，默认会自动备份
- 如需追加内容，应先 read 再合并后 write
- 严禁覆盖未备份的重要配置文件

#### 3. delete - 删除文件
**用途**: 删除文件或目录
**必需参数**:
- \`operation\`: "delete"
- \`filePath\`: 文件或目录路径

**可选参数**:
- \`backup\`: 是否先备份（默认 true）

**示例**:
\`\`\`json
{
  "operation": "delete",
  "filePath": "src/old-component.tsx",
  "backup": true
}
\`\`\`

**重要提醒**:
- 删除操作默认会创建备份
- 删除目录会递归删除其内容
- 执行前请确认路径正确

#### 4. list - 列出目录
**用途**: 列出指定目录的内容
**必需参数**:
- \`operation\`: "list"
- \`filePath\`: 目录路径

**示例**:
\`\`\`json
{
  "operation": "list",
  "filePath": "src/components"
}
\`\`\`

### 使用流程

1. **读取文件前**: 确认文件路径正确，使用相对路径
2. **写入文件前**: 如修改现有文件，先 read 了解当前内容
3. **删除文件前**: 确认文件不再需要，backup 设为 true
4. **操作完成后**: 检查返回结果，确认操作成功

### 错误处理

- 文件不存在: 检查路径是否正确，区分大小写
- 权限不足: 通知用户或项目经理
- 磁盘空间不足: 停止写入操作，通知相关人员
- 备份失败: 停止破坏性操作，等待人工确认

### 批量操作规范

如需读取多个文件，应逐个调用 read 操作，而非尝试一次性读取。
每个操作独立执行，独立处理错误。
`
