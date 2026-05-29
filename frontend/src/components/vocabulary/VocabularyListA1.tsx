'use client';

import React, { useEffect, useState } from 'react';
import { vocabularyApi } from '@/lib/api/vocabularyApi';
import VocabularyCard from './VocabularyCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Word {
  id: number;
  word: string;
  translation: string;
  audioUrl: string;
  pronunciation_ipa: string;
  example_sentence: string;
  article?: string;
  image_url?: string;
}

export default function VocabularyListA1() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVocabulary = async () => {
      try {
        setLoading(true);
        const words = await vocabularyApi.getA1Words();
        setWords(words);
      } catch (err) {
        setError('Failed to load vocabulary');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchVocabulary();
  }, []);

  if (loading) return <LoadingSpinner />;

  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Learn A1 German (50 words)</h1>
        <p className="text-gray-600">Master these foundational words to introduce yourself</p>
        <div className="mt-4 bg-blue-100 p-2 rounded">
          <p className="text-sm">{words.length}/50 words learned</p>
          <div className="w-full bg-gray-300 rounded h-2 mt-2">
            <div
              className="bg-blue-500 h-full rounded transition-all"
              style={{ width: `${(words.length / 50) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {words.map((word) => (
          <VocabularyCard key={word.id} word={word} />
        ))}
      </div>

      {words.length > 0 && (
        <div className="mt-8 text-center">
          <button className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            Ready to Speak? Start Greeting Practice →
          </button>
        </div>
      )}
    </div>
  );
}
