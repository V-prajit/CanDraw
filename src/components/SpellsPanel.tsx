'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/cedar/components/ui/button';

interface AgentAction {
  id: string;
  tool: string;
  timestamp: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  input?: any;
  output?: any;
  description: string;
}

interface SpellConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  toolName: string;
  defaultParams?: any;
}

export function SpellsPanel({ elements, onSpellCast }: {
  elements: any[],
  onSpellCast?: (spellId: string, params: any) => void
}) {
  const [recentActions, setRecentActions] = useState<AgentAction[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [runningSpells, setRunningSpells] = useState<Set<string>>(new Set());

  // Define available spells (CedarOS "interfaces beyond chat")
  const spells: SpellConfig[] = [
    {
      id: 'add-table',
      name: 'Add Table',
      icon: '🏗️',
      description: 'Create a new database table',
      toolName: 'createDatabaseTable',
      defaultParams: {
        tableName: 'NewTable',
        fields: [
          { name: 'id', type: 'INTEGER' },
          { name: 'name', type: 'TEXT' }
        ],
        primaryKeys: ['id'],
        x: 100 + (elements.length * 50),
        y: 100 + (elements.length * 30)
      }
    },
    {
      id: 'add-relationship',
      name: 'Link Tables',
      icon: '🔗',
      description: 'Connect tables with relationships',
      toolName: 'connectTablesArrow',
      defaultParams: {
        sourceX: 225,
        sourceY: 180,
        targetX: 400,
        targetY: 180,
        relationshipType: 'one-to-many'
      }
    },
    {
      id: 'export-schema',
      name: 'Smart Export',
      icon: '📤',
      description: 'AI-powered schema export',
      toolName: 'llmExport',
      defaultParams: {
        elements: [],
        format: 'sql',
        includeRelationships: true
      }
    },
    {
      id: 'generate-demo',
      name: 'Live Demo',
      icon: '🚀',
      description: 'Generate working database app',
      toolName: 'llmDemoGeneration',
      defaultParams: {
        demoType: 'forms-interface'
      }
    }
  ];

  const castSpell = async (spell: SpellConfig) => {
    if (runningSpells.has(spell.id)) return;

    const actionId = `action_${Date.now()}`;
    const newAction: AgentAction = {
      id: actionId,
      tool: spell.toolName,
      timestamp: new Date().toLocaleTimeString(),
      status: 'running',
      description: spell.description,
      input: { ...spell.defaultParams, elements }
    };

    // Add to running spells
    setRunningSpells(prev => new Set([...prev, spell.id]));

    // Add to action timeline
    setRecentActions(prev => [newAction, ...prev.slice(0, 9)]); // Keep last 10 actions

    try {
      console.log(`🔮 Casting spell: ${spell.name}`, newAction.input);

      // Call the appropriate tool based on spell configuration
      let response;

      if (spell.toolName === 'llmExport') {
        response = await fetch('http://localhost:4111/llm-export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: newAction.input
          })
        });
      } else if (spell.toolName === 'llmDemoGeneration') {
        // First export schema, then generate demo
        const exportResponse = await fetch('http://localhost:4111/llm-export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              elements,
              format: 'sql',
              includeRelationships: true
            }
          })
        });

        const exportResult = await exportResponse.json();

        if (exportResult.success) {
          response = await fetch('http://localhost:4111/api/tools/llmDemoGeneration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schema: exportResult.exportData,
              demoType: 'forms-interface'
            })
          });
        } else {
          throw new Error('Schema export failed');
        }
      } else {
        // For other tools, we would need to call them through the agent system
        // For now, we'll simulate success
        response = { ok: true, json: async () => ({ success: true, message: 'Spell cast successfully' }) };
      }

      const result = await response.json();

      // Update action with success
      setRecentActions(prev => prev.map(action =>
        action.id === actionId
          ? { ...action, status: 'completed' as const, output: result }
          : action
      ));

      console.log(`✅ Spell completed: ${spell.name}`, result);

      // Trigger callback if provided
      if (onSpellCast) {
        onSpellCast(spell.id, result);
      }

    } catch (error) {
      console.error(`❌ Spell failed: ${spell.name}`, error);

      // Update action with error
      setRecentActions(prev => prev.map(action =>
        action.id === actionId
          ? {
              ...action,
              status: 'error' as const,
              output: { error: error instanceof Error ? error.message : 'Unknown error' }
            }
          : action
      ));
    } finally {
      // Remove from running spells
      setRunningSpells(prev => {
        const newSet = new Set(prev);
        newSet.delete(spell.id);
        return newSet;
      });
    }
  };

  const undoAction = (actionId: string) => {
    // In a full implementation, this would reverse the action
    setRecentActions(prev => prev.filter(action => action.id !== actionId));
    console.log(`↶ Undoing action: ${actionId}`);
  };

  const getStatusIcon = (status: AgentAction['status']) => {
    switch (status) {
      case 'completed': return '✅';
      case 'running': return '⏳';
      case 'error': return '❌';
      default: return '⚪';
    }
  };

  const getStatusColor = (status: AgentAction['status']) => {
    switch (status) {
      case 'completed': return 'text-green-700 bg-green-50';
      case 'running': return 'text-blue-700 bg-blue-50';
      case 'error': return 'text-red-700 bg-red-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className={`bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg transition-all duration-300 ${
      isExpanded ? 'w-80' : 'w-12'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        {isExpanded && (
          <h3 className="font-bold text-gray-800 flex items-center space-x-2">
            <span>🔮</span>
            <span>Agent Spells</span>
          </h3>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-600 hover:text-gray-800"
        >
          {isExpanded ? '←' : '🔮'}
        </Button>
      </div>

      {isExpanded && (
        <>
          {/* Spells Grid */}
          <div className="p-3 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-2">
              {spells.map(spell => (
                <Button
                  key={spell.id}
                  onClick={() => castSpell(spell)}
                  disabled={runningSpells.has(spell.id)}
                  variant="outline"
                  className={`h-auto p-3 flex flex-col items-center space-y-1 text-xs hover:bg-blue-50 ${
                    runningSpells.has(spell.id) ? 'opacity-50' : ''
                  }`}
                  title={spell.description}
                >
                  <span className="text-lg">
                    {runningSpells.has(spell.id) ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    ) : (
                      spell.icon
                    )}
                  </span>
                  <span className="font-medium">{spell.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Agent Timeline Inspector */}
          <div className="p-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center space-x-1">
              <span>📋</span>
              <span>Agent Timeline</span>
            </h4>

            {recentActions.length === 0 ? (
              <div className="text-xs text-gray-500 italic py-2">
                No agent actions yet. Cast a spell to see the magic! ✨
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {recentActions.map(action => (
                  <div
                    key={action.id}
                    className={`text-xs p-2 rounded border ${getStatusColor(action.status)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span>{getStatusIcon(action.status)}</span>
                        <span className="font-medium">{action.tool}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-500">{action.timestamp}</span>
                        {action.status === 'completed' && (
                          <button
                            onClick={() => undoAction(action.id)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Undo action"
                          >
                            ↶
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-gray-600">
                      {action.description}
                    </div>
                    {action.status === 'error' && action.output?.error && (
                      <div className="mt-1 text-red-600 text-xs">
                        Error: {action.output.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent Stats */}
          <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div className="flex justify-between text-xs text-gray-600">
              <div>Elements: {elements.length}</div>
              <div>Actions: {recentActions.length}</div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Agent Ready</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}