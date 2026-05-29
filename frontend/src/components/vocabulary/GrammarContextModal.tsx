'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface GrammarContext {
  word: string;
  partOfSpeech: string;
  grammar: {
    caseInfo?: string;
    genderInfo?: string;
    tensInfo?: string;
    conjugationPattern?: string;
  };
  examples: Array<{
    german: string;
    english: string;
  }>;
  relatedWords?: string[];
}

interface GrammarContextModalProps {
  isOpen: boolean;
  wordId: number;
  onClose: () => void;
  word?: string;
}

export default function GrammarContextModal({ isOpen, wordId, onClose, word }: GrammarContextModalProps) {
  const [context, setContext] = useState<GrammarContext | null>(null);
  const [loading, setLoading] = useState(false);

  const loadGrammarContext = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<GrammarContext>(`/vocabulary/${wordId}/grammar-context`);
      setContext(data);
    } catch (error) {
      console.error('Failed to load grammar context:', error);
    } finally {
      setLoading(false);
    }
  }, [wordId]);

  useEffect(() => {
    if (isOpen && wordId) {
      loadGrammarContext();
    }
  }, [isOpen, wordId, loadGrammarContext]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{context?.word}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : context ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-600">Part of Speech</p>
              <p className="text-base">{context.partOfSpeech}</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">Grammar</p>
              <div className="space-y-1 text-sm">
                {context.grammar.genderInfo && (
                  <p>
                    <span className="font-medium">Gender:</span> {context.grammar.genderInfo}
                  </p>
                )}
                {context.grammar.caseInfo && (
                  <p>
                    <span className="font-medium">Case:</span> {context.grammar.caseInfo}
                  </p>
                )}
                {context.grammar.tensInfo && (
                  <p>
                    <span className="font-medium">Tense:</span> {context.grammar.tensInfo}
                  </p>
                )}
                {context.grammar.conjugationPattern && (
                  <p>
                    <span className="font-medium">Pattern:</span> {context.grammar.conjugationPattern}
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">Examples</p>
              <div className="space-y-2">
                {context.examples.map((example, idx) => (
                  <div key={idx} className="bg-blue-50 p-2 rounded text-sm">
                    <p className="font-medium text-blue-900">{example.german}</p>
                    <p className="text-blue-700">{example.english}</p>
                  </div>
                ))}
              </div>
            </div>

            {context.relatedWords && context.relatedWords.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">Related Words</p>
                <div className="flex flex-wrap gap-2">
                  {context.relatedWords.map((relatedWord) => (
                    <span
                      key={relatedWord}
                      className="px-2 py-1 bg-gray-100 rounded text-xs font-medium"
                    >
                      {relatedWord}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500">No grammar context available</p>
        )}

        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}
