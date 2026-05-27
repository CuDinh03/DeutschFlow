'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface WordData {
  id: number;
  word: string;
  translation: string;
  audioUrl: string;
  article?: string;
  example_sentence: string;
}

interface SRSCardProps {
  word: WordData;
  onRate: (wordId: number, confidence: 1 | 2 | 3 | 4 | 5) => void;
}

export default function SRSCard({ word, onRate }: SRSCardProps) {
  const [showBack, setShowBack] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleRate = (confidence: 1 | 2 | 3 | 4 | 5) => {
    onRate(word.id, confidence);
    setShowBack(false);
    setSubmitted(false);
  };

  const playAudio = () => {
    const audio = new Audio(word.audioUrl);
    audio.play();
  };

  return (
    <div className="w-full max-w-md mx-auto perspective">
      <div
        className={`relative w-full h-64 transition-transform duration-300 transform ${
          showBack ? 'rotate-y-180' : ''
        }`}
        style={{
          transformStyle: 'preserve-3d',
          transform: showBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front of card */}
        <div
          className="absolute w-full h-full bg-blue-100 border-2 border-blue-500 rounded-lg p-6 flex flex-col items-center justify-center"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <h2 className="text-4xl font-bold mb-4 text-center">{word.word}</h2>
          <button
            onClick={playAudio}
            className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            🔊 Hear pronunciation
          </button>
          <button
            onClick={() => setShowBack(true)}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reveal Answer
          </button>
        </div>

        {/* Back of card */}
        <div
          className="absolute w-full h-full bg-green-100 border-2 border-green-500 rounded-lg p-6 flex flex-col items-center justify-center"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <h3 className="text-2xl font-bold mb-2 text-center">{word.translation}</h3>
          {word.article && (
            <p className="text-sm text-gray-600 mb-3">Article: <span className="font-semibold">{word.article}</span></p>
          )}
          <p className="text-sm text-gray-700 mb-4 italic text-center">{word.example_sentence}</p>

          {!submitted ? (
            <div className="w-full">
              <p className="text-xs text-gray-600 mb-3 text-center">How well did you know it?</p>
              <div className="flex gap-2 flex-wrap justify-center">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRate(1)}
                  className="text-xs"
                >
                  😅 Forgot
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRate(2)}
                  className="text-xs"
                >
                  😕 Struggle
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRate(3)}
                  className="text-xs"
                >
                  😐 OK
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRate(4)}
                  className="text-xs"
                >
                  😊 Good
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleRate(5)}
                  className="text-xs"
                >
                  😍 Perfect!
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-green-700 font-semibold">Great! Moving to next word...</p>
          )}
        </div>
      </div>
    </div>
  );
}
