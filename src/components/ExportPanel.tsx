'use client';

import React, { useState } from 'react';
import { Button } from '@/cedar/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/cedar/components/ui/dialog';

interface ExportResult {
  success: boolean;
  exportData?: {
    tables: Array<{
      name: string;
      fields: Array<{
        name: string;
        type: string;
        isPrimaryKey: boolean;
        isRequired: boolean;
      }>;
    }>;
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      foreignKey: string;
    }>;
    sql: string;
    description: string;
  };
  error?: string;
  fallbackData?: any;
}

export function ExportPanel({ elements }: { elements: any[] }) {
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string>('');

  const handleExport = async () => {
    if (elements.length === 0) {
      setError('No elements on canvas to export. Please create some tables first.');
      return;
    }

    setIsExporting(true);
    setError('');

    try {
      // Call the LLM export tool via the backend API
      console.log('📤 Calling LLM export with', elements.length, 'elements');

      const response = await fetch('http://localhost:4111/llm-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            elements
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Export successful:', result);

      setExportResult(result);

    } catch (err) {
      console.error('❌ Export failed:', err);
      setError(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // Could add a toast notification here
      console.log('📋 Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getExportContent = (): string => {
    if (!exportResult?.exportData) return '';

    const { sql, description } = exportResult.exportData;

    return `-- Database Schema Export
-- Generated on ${new Date().toISOString()}

-- DESCRIPTION:
-- ${description || 'No description available'}

-- SQL SCHEMA:
${sql || '-- No SQL generated'}`;
  };

  const getFileName = (): string => {
    return 'database-schema.sql';
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          📤 Export SQL
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>📤 Export SQL Schema</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Export Controls */}
          <div className="flex justify-between items-center">
            <Button
              onClick={handleExport}
              disabled={isExporting || elements.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isExporting ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>AI Analyzing...</span>
                </div>
              ) : (
                '🧠 Generate SQL + Description'
              )}
            </Button>

            <div className="text-sm text-gray-600">
              {elements.length} elements on canvas
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">❌ {error}</p>
            </div>
          )}

          {/* Success Display */}
          {exportResult?.success && exportResult.exportData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-green-800 text-sm font-medium">
                  ✅ Export successful! Found {exportResult.exportData.tables?.length || 0} tables
                  {exportResult.exportData.relationships && exportResult.exportData.relationships.length > 0 &&
                    ` and ${exportResult.exportData.relationships.length} relationships`
                  }
                </p>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(getExportContent())}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    📋 Copy
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => downloadFile(getExportContent(), getFileName())}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    💾 Download
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Export Content Display */}
          {exportResult?.exportData && (
            <div className="flex-1 overflow-hidden">
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto h-full max-h-96 font-mono">
                {getExportContent()}
              </pre>
            </div>
          )}

          {/* Fallback Data Display */}
          {exportResult && !exportResult.success && exportResult.fallbackData && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm font-medium mb-2">
                ⚠️ AI parsing failed, showing fallback analysis:
              </p>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(exportResult.fallbackData, null, 2)}
              </pre>
            </div>
          )}

          {/* Schema Summary */}
          {exportResult?.exportData?.tables && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">📊 Schema Summary</h4>
              <div className="text-sm text-blue-700 space-y-1">
                {exportResult.exportData.tables.map((table, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <span className="font-medium">{table.name}:</span>
                    <span>{table.fields?.length || 0} fields</span>
                    {table.fields?.some(f => f.isPrimaryKey) && (
                      <span className="text-xs bg-blue-200 px-1 rounded">🔑 PK</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}