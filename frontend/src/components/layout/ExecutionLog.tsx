import { useState, useEffect } from 'react';
import { X, Trash2, Filter } from 'lucide-react';

interface ExecutionLogProps {
  onClose: () => void;
  ws: WebSocket | null;
}

interface LogEntry {
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  nodeId?: string;
  message: string;
}

export default function ExecutionLog({ onClose, ws }: ExecutionLogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('all');

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        setLogs((prev) => [...prev, data.entry]);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws]);

  const clearLogs = () => {
    setLogs([]);
  };

  const filteredLogs = filterLevel === 'all' 
    ? logs 
    : logs.filter((log) => log.level === filterLevel);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      case 'debug': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[200px] bg-gray-900 text-gray-100 border-t border-gray-700 flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">执行日志</span>
          <span className="text-[10px] text-gray-500">({filteredLogs.length} 条)</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="text-[10px] bg-gray-800 border border-gray-600 rounded px-1 py-0.5"
          >
            <option value="all">全部</option>
            <option value="error">错误</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
            <option value="debug">调试</option>
          </select>
          <button
            onClick={clearLogs}
            className="p-1 hover:bg-gray-800 rounded"
            title="清空日志"
          >
            <Trash2 size={12} className="text-gray-500" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded"
          >
            <X size={12} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* 日志内容 */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-0.5">
        {filteredLogs.map((log, index) => (
          <div key={index} className="flex gap-2">
            <span className="text-gray-500 shrink-0">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={`${getLevelColor(log.level)} shrink-0 w-12`}>
              [{log.level.toUpperCase()}]
            </span>
            {log.nodeId && (
              <span className="text-gray-500 shrink-0">[{log.nodeId}]</span>
            )}
            <span className="text-gray-300">{log.message}</span>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="text-gray-500 text-center py-4">暂无日志</div>
        )}
      </div>
    </div>
  );
}
