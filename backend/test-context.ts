// 测试上下文系统的脚本
import { initContextManager, getContextManager } from './src/modules/context';

async function testContextSystem() {
  console.log('=== 开始测试上下文持久化系统 ===');
  
  // 初始化上下文管理器
  const projectPath = process.cwd();
  initContextManager(projectPath);
  const manager = getContextManager();
  
  console.log('\n1. 测试项目上下文...');
  const projectContext = manager.getProjectContext();
  console.log('项目上下文:', JSON.stringify(projectContext, null, 2));
  
  console.log('\n2. 测试创建对话...');
  const conversationId = 'test-conv-001';
  const conversation = manager.createConversation(conversationId, '测试对话');
  console.log('已创建对话:', JSON.stringify(conversation, null, 2));
  
  console.log('\n3. 测试添加消息...');
  manager.addMessage(conversationId, {
    id: 'msg-001',
    role: 'user',
    content: '你好，这是一条测试消息',
    timestamp: new Date().toISOString()
  });
  
  manager.addMessage(conversationId, {
    id: 'msg-002',
    role: 'ai',
    content: '你好！这是AI的回复',
    timestamp: new Date().toISOString()
  });
  
  console.log('\n4. 测试添加记忆...');
  manager.addMemory(conversationId, {
    id: 'mem-001',
    type: 'fact',
    content: '用户喜欢使用TypeScript',
    timestamp: new Date().toISOString(),
    importance: 5,
    tags: ['user', 'preference']
  });
  
  console.log('\n5. 测试添加任务...');
  manager.addTask(conversationId, {
    id: 'task-001',
    title: '实现上下文持久化',
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    result: '成功实现了上下文持久化系统'
  });
  
  console.log('\n6. 加载并验证对话...');
  const loadedContext = manager.loadConversationContext(conversationId);
  console.log('加载的对话:', JSON.stringify(loadedContext, null, 2));
  
  console.log('\n7. 列出所有对话...');
  const conversations = manager.listConversationsWithMetadata();
  console.log('对话列表:', JSON.stringify(conversations, null, 2));
  
  console.log('\n=== 上下文系统测试完成！===');
  console.log('数据已保存到项目的 .flowmind 文件夹中');
}

testContextSystem().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
