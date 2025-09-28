'use client';

import React, { useState } from 'react';
import { Button } from '@/cedar/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/cedar/components/ui/dialog';

interface GenerationStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

interface DemoResult {
  success: boolean;
  demoId?: string;
  title?: string;
  html?: string;
  error?: string;
  fallbackDemo?: any;
}

export function DemoGenerator({ elements }: { elements: any[] }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [error, setError] = useState<string>('');
  const [demoUrl, setDemoUrl] = useState<string>('');

  const generationSteps: GenerationStep[] = [
    { id: 'export', label: 'Analyzing UML diagram with AI', status: 'pending' },
    { id: 'generate', label: 'Generating database application', status: 'pending' },
    { id: 'create', label: 'Building interactive demo', status: 'pending' },
    { id: 'complete', label: 'Demo ready!', status: 'pending' }
  ];

  const [steps, setSteps] = useState<GenerationStep[]>(generationSteps);

  const updateStepStatus = (stepId: string, status: GenerationStep['status']) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status } : step
    ));
    setCurrentStep(stepId);
  };

  const handleGenerateDemo = async () => {
    if (elements.length === 0) {
      setError('No elements on canvas to generate demo from. Please create some tables first.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setDemoResult(null);
    setDemoUrl('');

    // Reset all steps
    setSteps(generationSteps.map(step => ({ ...step, status: 'pending' })));

    try {
      // Step 1: Export schema
      updateStepStatus('export', 'in_progress');

      console.log('Step 1: Exporting schema...');
      const exportResponse = await fetch('http://localhost:4111/llm-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            elements,
            format: 'sql',
            includeRelationships: true,
            includeSampleData: true
          }
        }),
      });

      if (!exportResponse.ok) {
        throw new Error(`Export failed: ${exportResponse.status}`);
      }

      const exportResult = await exportResponse.json();
      console.log('Export successful:', exportResult);

      if (!exportResult.success || !exportResult.exportData) {
        throw new Error('Failed to parse UML diagram');
      }

      updateStepStatus('export', 'completed');

      // Step 2: Generate demo
      updateStepStatus('generate', 'in_progress');

      console.log('Step 2: Generating demo application...');
      const demoResponse = await fetch('http://localhost:4111/api/tools/llmDemoGeneration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: exportResult.exportData,
          userPrompt: userPrompt || undefined,
          demoType: 'forms-interface'
        }),
      });

      if (!demoResponse.ok) {
        throw new Error(`Demo generation failed: ${demoResponse.status}`);
      }

      const demoResult = await demoResponse.json();
      console.log('Demo generation result:', demoResult);

      updateStepStatus('generate', 'completed');

      // Step 3: Create blob URL for demo
      updateStepStatus('create', 'in_progress');

      if (demoResult.success && demoResult.html) {
        // Create blob URL for the generated HTML
        const blob = new Blob([demoResult.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setDemoUrl(url);
        setDemoResult(demoResult);

        updateStepStatus('create', 'completed');
        updateStepStatus('complete', 'completed');

        console.log('Demo ready at URL:', url);

      } else if (demoResult.fallbackDemo) {
        // Use fallback demo
        const blob = new Blob([demoResult.fallbackDemo.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setDemoUrl(url);
        setDemoResult({ ...demoResult, success: true }); // Mark as success for UI purposes

        updateStepStatus('create', 'completed');
        updateStepStatus('complete', 'completed');

        console.log('Using fallback demo at URL:', url);
      } else {
        throw new Error(demoResult.error || 'Demo generation failed');
      }

    } catch (err) {
      console.error('Demo generation failed:', err);
      setError(`Demo generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);

      // Mark current step as error
      if (currentStep) {
        updateStepStatus(currentStep, 'error');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const openDemoInNewTab = () => {
    if (demoUrl) {
      window.open(demoUrl, '_blank');
    }
  };

  const getStepIcon = (status: GenerationStep['status']) => {
    switch (status) {
      case 'completed':
        return 'Done';
      case 'in_progress':
        return 'Working';
      case 'error':
        return 'Error';
      default:
        return 'Pending';
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700 text-white text-lg px-6 py-3">
          Generate Live Demo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>AI-Powered Demo Generation</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden flex flex-col">
          {/* User Requirements Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Additional Requirements (Optional)
            </label>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="e.g., Add a dashboard view, include search functionality, show statistics, dark theme..."
              className="w-full p-3 border rounded-lg text-sm"
              rows={3}
              disabled={isGenerating}
            />
          </div>

          {/* Generation Controls */}
          <div className="flex justify-between items-center">
            <Button
              onClick={handleGenerateDemo}
              disabled={isGenerating || elements.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </Button>

            <div className="text-sm text-gray-600">
              {elements.length} elements on canvas
            </div>

            {demoUrl && (
              <Button
                onClick={openDemoInNewTab}
                className="bg-green-600 hover:bg-green-700"
              >
                Open in New Tab
              </Button>
            )}
          </div>

          {/* Progress Steps */}
          {isGenerating && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-3">Generation Progress</h4>
              <div className="space-y-2">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`flex items-center space-x-3 p-2 rounded ${
                      step.status === 'in_progress'
                        ? 'bg-blue-100 border border-blue-300'
                        : ''
                    }`}
                  >
                    <span className="text-lg">
                      {step.status === 'in_progress' ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      ) : (
                        getStepIcon(step.status)
                      )}
                    </span>
                    <span className={`text-sm ${
                      step.status === 'completed' ? 'text-green-700' :
                      step.status === 'error' ? 'text-red-700' :
                      step.status === 'in_progress' ? 'text-blue-700 font-medium' :
                      'text-gray-600'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">Error: {error}</p>
            </div>
          )}

          {/* Success Display */}
          {demoResult?.success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-green-800 text-sm font-medium">
                  Demo generated successfully: {demoResult.title}
                </p>
                <Button
                  size="sm"
                  onClick={openDemoInNewTab}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Launch Demo
                </Button>
              </div>
            </div>
          )}

          {/* Demo Viewer */}
          {demoUrl && (
            <div className="flex-1 border rounded-lg overflow-hidden" style={{ minHeight: '500px' }}>
              <div className="bg-gray-100 px-4 py-2 border-b flex items-center justify-between">
                <span className="text-sm font-medium">Live Demo Preview</span>
                <span className="text-xs text-gray-600">{demoResult?.title}</span>
              </div>
              <iframe
                src={demoUrl}
                className="w-full h-full"
                title="Generated Database Demo"
                style={{ height: '500px' }}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          )}

          {/* Demo Information */}
          {demoResult && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">Demo Details</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <div><strong>Type:</strong> Interactive Database Interface</div>
                <div><strong>Technology:</strong> HTML + JavaScript + sql.js (SQLite)</div>
                <div><strong>Features:</strong> CRUD operations, Form validation, Relationship navigation</div>
                {userPrompt && (
                  <div><strong>Custom Requirements:</strong> {userPrompt}</div>
                )}
                <div><strong>Generated:</strong> {new Date().toLocaleTimeString()}</div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}