'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ListeningExercise {
  id: number;
  wordId: number;
  word: string;
  audioUrl: string;
  correctAnswer: string;
  options: string[];
  userConfidenceScore?: 1 | 2 | 3 | 4 | 5;
}

interface ListeningPracticeProps {
  exercise: ListeningExercise;
  onComplete: (exerciseId: number, selectedAnswer: string, confidence: 1 | 2 | 3 | 4 | 5) => void;
}

export default function ListeningPractice({ exercise, onComplete }: ListeningPracticeProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = () => {
    setIsPlaying(true);
    const audio = new Audio(exercise.audioUrl);
    audio.onended = () => setIsPlaying(false);
    audio.play();
  };

  const handleSubmit = () => {
    if (selectedAnswer && confidence) {
      onComplete(exercise.id, selectedAnswer, confidence);
    }
  };

  const isAnswered = selectedAnswer === exercise.correctAnswer;

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">What word do you hear?</h3>
        <button
          onClick={playAudio}
          disabled={isPlaying}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          🔊 {isPlaying ? 'Playing...' : 'Play Audio'}
        </button>
      </div>

      <div className="space-y-2 mb-6">
        {exercise.options.map((option) => (
          <button
            key={option}
            onClick={() => setSelectedAnswer(option)}
            className={`w-full p-3 text-left rounded border-2 transition-colors ${
              selectedAnswer === option
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-200'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {selectedAnswer && (
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3">How confident are you?</p>
          <div className="flex gap-2 justify-between">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                onClick={() => setConfidence(level as 1 | 2 | 3 | 4 | 5)}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                  confidence === level
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!selectedAnswer || !confidence}
        className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
      >
        Check Answer
      </button>

      {selectedAnswer && (
        <div className={`mt-4 p-3 rounded text-sm ${isAnswered ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {isAnswered ? '✓ Correct!' : '✗ Incorrect. The answer is: ' + exercise.correctAnswer}
        </div>
      )}
    </div>
  );
}
