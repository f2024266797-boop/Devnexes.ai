import React, { useState } from 'react';
import { Sparkles, ArrowRight, Check, Wrench } from 'lucide-react';
import { detectRequestedProgrammingLanguage } from '../services/agentOrchestrator';

/**
 * Detects whether the assistant response represents an actionable scenario
 * where further follow-up work is possible (e.g. code error diagnosis, layout plan, optimization).
 */
function detectActionableScenario(assistantText = '', userPrompt = '', hasCodeArtifact = false) {
  if (!assistantText || typeof assistantText !== 'string') return null;

  // 1. If code artifact was already generated in this response or already fixed:
  // NEVER show the card asking "Would you like me to correct/fix this code?"
  if (hasCodeArtifact) return null;

  const lowerAsst = assistantText.toLowerCase();
  const lowerUser = (userPrompt || '').toLowerCase();

  const isUrdu = /\b(kya|ha|hai|hain|karo|kardo|banao|mujhe|aap|ap|ye|yeh|chahiye|nahi|nhi|ka|ki|ke|me|mein|ko)\b/i.test(lowerUser + ' ' + lowerAsst);

  // 2. Check if the assistant response already provides the fixed/corrected code
  const hasSubstantialCodeBlock = /```[a-zA-Z0-9_-]*\n[\s\S]{50,}\n```/.test(assistantText);
  const alreadyFixed = (
    hasSubstantialCodeBlock ||
    /\b(corrected|fixed code|here is the corrected|here is the fixed|maine (code )?(theek|sahi|fix) kar diya|code ko fix kar diya|all defects resolved|all issues resolved|here is the complete fixed|has been corrected|following is the corrected|solution implementation|fixed implementation)\b/i.test(lowerAsst) ||
    (/\b(fix|theek|sahi|correct|solve|debug)\b/i.test(lowerUser) && /\b(corrected|fixed|solution|update|resolved|here is)\b/i.test(lowerAsst))
  );

  // 3. Code Error Diagnosis / Defect Breakdown / Bug Review
  // ONLY show when the assistant JUST identifies / explains the errors without having fixed them yet.
  const hasCodeDefects = (
    /\b(defect|defects|diagnostic summary|syntax violation|runtime error|undefined behavior|undeclared identifier|compilation error|errors found|issues identified|bugs found|diagnostic breakdown|distinct defects)\b/i.test(lowerAsst) ||
    (/\b(#include|def |function |const |int main|class |struct |var |let |cout <<|cin >>)\b/i.test(lowerUser) && /\b(error|errors|issue|issues|bug|bugs|fix|warning|fault)\b/i.test(lowerAsst))
  );

  // If user already asked to fix, or code is already fixed/provided, don't ask again!
  const userAlreadyAskedToFix = /\b(fix|theek|sahi|correct|solve|debug)\b/i.test(lowerUser);

  if (hasCodeDefects && !alreadyFixed && !userAlreadyAskedToFix) {
    const detectedLang = detectRequestedProgrammingLanguage(userPrompt, assistantText);
    const langUpper = detectedLang ? detectedLang.toUpperCase() : null;
    const langLabel = langUpper ? `${langUpper} ` : '';

    return {
      type: 'CODE_FIX',
      targetLanguage: detectedLang,
      question: isUrdu
        ? `Aap is ${langLabel}code ko correct / fix karwana chahte hain?`
        : `Would you like me to correct and fix this ${langLabel}code in Code Canvas?`,
      quickAction: isUrdu ? `✓ ${langLabel}Code fix kar do` : `✓ Fix & Correct ${langLabel}Code`,
      defaultPrompt: detectedLang
        ? `Please correct and fix this ${langUpper} code with modern best practices, and open the complete corrected ${langUpper} code in Code Canvas.`
        : 'Please correct and fix this code with modern best practices, and open the complete corrected code in Code Canvas.',
      customPrefix: isUrdu
        ? `Kripya is ${langLabel}code ko in requirements ke mutabiq fix karein: `
        : `Please fix and correct this ${langLabel}code according to these requirements: `,
      placeholder: isUrdu
        ? `Aap ki specific requirement (e.g. ${langUpper || 'C++20'}, smart pointers, comments)...`
        : `Specific requirement (e.g. ${langUpper || 'C++20'}, smart pointers, comments)...`
    };
  }

  // 2. Layout & Architectural Blueprint without full code yet
  const hasArchitecturePlan = /\b(architectural blueprint|layout blueprint|component blueprint|layout plan|planned layout)\b/i.test(lowerAsst) &&
    !lowerAsst.includes('<!doctype') && !lowerAsst.includes('<html');

  if (hasArchitecturePlan) {
    return {
      type: 'BUILD_CANVAS',
      question: isUrdu
        ? 'Aap is layout ki interactive website / code Canvas me banana chahte hain?'
        : 'Would you like me to build this complete website in Code Canvas?',
      quickAction: isUrdu ? '✓ Canvas me website banao' : '✓ Build in Code Canvas',
      defaultPrompt: 'Please implement this complete modern website in Code Canvas based on the planned layout.',
      customPrefix: isUrdu
        ? 'Kripya website Canvas me in requirements ke mutabiq banayein: '
        : 'Please build the website in Code Canvas with these specifications: ',
      placeholder: isUrdu
        ? 'Theme ya visual preference (optional)...'
        : 'Custom theme or styling preference (optional)...'
    };
  }

  // 3. Performance & Optimization Review
  const hasOptimization = /\b(time complexity|space complexity|performance bottleneck|memory leak|profiling|optimization strategy|big-o)\b/i.test(lowerAsst);
  if (hasOptimization) {
    return {
      type: 'OPTIMIZE',
      question: isUrdu
        ? 'Aap is code ko optimize aur benchmark karwana chahte hain?'
        : 'Would you like me to optimize this code?',
      quickAction: isUrdu ? '✓ Optimize code' : '✓ Optimize Code',
      defaultPrompt: 'Please optimize this code for maximum performance and efficiency in Code Canvas.',
      customPrefix: isUrdu
        ? 'Kripya is code ko optimize karein: '
        : 'Please optimize this code with focus on: ',
      placeholder: isUrdu
        ? 'Target goal (e.g. speed, memory, concurrency)...'
        : 'Target goal (e.g. speed, memory, concurrency)...'
    };
  }

  // 4. Test Cases & Verification
  const hasTesting = /\b(edge case|test coverage|unit test|corner cases|boundary conditions)\b/i.test(lowerAsst);
  if (hasTesting) {
    return {
      type: 'TESTS',
      question: isUrdu
        ? 'Aap is code ke comprehensive unit tests likhwana chahte hain?'
        : 'Would you like me to generate comprehensive unit tests?',
      quickAction: isUrdu ? '✓ Unit tests likho' : '✓ Generate Unit Tests',
      defaultPrompt: 'Please generate comprehensive unit tests covering all edge cases for this code in Code Canvas.',
      customPrefix: isUrdu
        ? 'Kripya unit tests likhein: '
        : 'Please generate unit tests focusing on: ',
      placeholder: isUrdu
        ? 'Testing framework (e.g. GTest, Catch2, Jest)...'
        : 'Testing framework (e.g. GTest, Catch2, Jest)...'
    };
  }

  return null;
}

/**
 * Interactive Follow-up Action Card
 * Appears at the bottom of actionable assistant messages,
 * providing a 1-click action button and an optional custom input blank.
 */
export default function FollowUpActionCard({
  assistantText,
  userPrompt,
  onSendMessage,
  isExecuting = false,
  hasCodeArtifact = false
}) {
  const [customInput, setCustomInput] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (isExecuting) return null;

  const scenario = detectActionableScenario(assistantText, userPrompt, hasCodeArtifact);
  if (!scenario || isSubmitted) return null;

  const isAffirmative = (text) => {
    const clean = String(text || '').toLowerCase().trim().replace(/['"“”]/g, '');
    return /^(yes|yeah|yep|yup|y|haan|ha|ji|ji haan|ji han|theek hai|ok|okay|sure|kardo|krdo|fix karo|theek karo|sahi karo|bilkul|solve karo)$/i.test(clean);
  };

  const dispatchAction = (input = '') => {
    if (!onSendMessage) return;
    setIsSubmitted(true);
    const trimmed = input.trim();
    if (!trimmed || isAffirmative(trimmed)) {
      onSendMessage(scenario.defaultPrompt, null, {
        isFollowUpAnswer: true,
        question: scenario.question,
        targetLanguage: scenario.targetLanguage
      });
    } else {
      onSendMessage(`${scenario.customPrefix}"${trimmed}"`, null, {
        isFollowUpAnswer: true,
        question: scenario.question,
        targetLanguage: scenario.targetLanguage
      });
    }
  };

  const handleQuickAction = () => {
    dispatchAction(customInput);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    dispatchAction(customInput);
  };

  return (
    <div className="mt-3.5 mb-1 p-3 sm:p-3.5 rounded-xl border border-blue-200/90 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 backdrop-blur-xs font-sans animate-step-reveal shadow-2xs">
      {/* Header Question */}
      <div className="flex items-center space-x-2 text-neutral-800 dark:text-neutral-200 mb-2.5">
        <div className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-950 text-[#0066FF] dark:text-blue-400 flex items-center justify-center shrink-0">
          <Sparkles size={12} />
        </div>
        <span className="text-[13px] sm:text-[13.5px] font-medium leading-snug">
          {scenario.question}
        </span>
      </div>

      {/* Interactive Follow-up Actions Row */}
      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Quick Action Button */}
        <button
          type="button"
          onClick={handleQuickAction}
          className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#0066FF] hover:bg-blue-600 active:scale-[0.98] text-white text-xs font-medium shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Wrench size={12} />
          <span>{scenario.quickAction}</span>
        </button>

        {/* Blank Input Field for Custom Requirements */}
        <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-[#0c0e14] rounded-lg border border-neutral-200/90 dark:border-neutral-800 px-2.5 py-1 focus-within:border-blue-500 transition-colors">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder={scenario.placeholder}
            className="flex-1 bg-transparent border-0 text-xs sm:text-[12.5px] text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none font-sans"
          />
          <button
            type="submit"
            className="p-1 rounded-md text-neutral-400 hover:text-[#0066FF] dark:hover:text-blue-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
            title="Submit requirement"
          >
            {customInput.trim() ? <ArrowRight size={13} /> : <Check size={13} />}
          </button>
        </div>
      </form>
    </div>
  );
}
