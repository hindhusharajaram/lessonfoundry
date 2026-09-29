import React from 'react';
import { ShieldCheck, AlertCircle, FileText, CheckCircle2, Lock } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Claim } from '../../types';

interface EvidenceViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  claim: Claim | null;
  sourceText: string;
  sourceVersionNo?: number;
  sourceSha256?: string;
}

export const EvidenceViewerModal: React.FC<EvidenceViewerModalProps> = ({
  isOpen,
  onClose,
  claim,
  sourceText,
  sourceVersionNo = 1,
  sourceSha256,
}) => {
  if (!claim) return null;

  const charStart = claim.char_start ?? -1;
  const charEnd = claim.char_end ?? -1;
  const hasOffset = charStart >= 0 && charEnd > charStart && charEnd <= sourceText.length;

  const beforeText = hasOffset ? sourceText.slice(0, charStart) : '';
  const highlightedText = hasOffset ? sourceText.slice(charStart, charEnd) : claim.source_quote;
  const afterText = hasOffset ? sourceText.slice(charEnd) : sourceText;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <span>Non-LLM Evidence & Quote Grounding</span>
        </div>
      }
      subtitle={`Source Version v${sourceVersionNo} • Exact Character Range Verification`}
      maxWidth="2xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close Evidence Viewer
        </Button>
      }
    >
      <div className="space-y-5 text-xs">
        {/* Claim Verification Card */}
        <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Generated Claim / Sentence
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                claim.verified
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {claim.verified ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified (Score: {(claim.match_score * 100).toFixed(1)}%)
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  Unsupported Claim
                </>
              )}
            </span>
          </div>

          <p className="text-slate-800 font-medium text-sm leading-relaxed">&ldquo;{claim.text}&rdquo;</p>

          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-600 block mb-1 text-[11px]">
              Extracted Supporting Quote:
            </span>
            <p className="font-mono text-indigo-900 text-xs bg-indigo-50/60 p-2 rounded border border-indigo-100">
              &ldquo;{claim.source_quote}&rdquo;
            </p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Offsets: [{charStart} : {charEnd}]</span>
              {sourceSha256 && <span>SHA256: {sourceSha256.substring(0, 16)}...</span>}
            </div>
          </div>
        </div>

        {/* Source Text Highlighting */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-slate-700 font-semibold">
            <span>Ground Truth Source Document</span>
            <span className="text-[11px] text-slate-400 font-normal">
              Highlighted excerpt matches quote in source
            </span>
          </div>

          <div className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto border border-slate-800 shadow-inner">
            {hasOffset ? (
              <span>
                <span className="text-slate-400">{beforeText}</span>
                <mark className="bg-amber-300 text-slate-950 font-bold px-1 py-0.5 rounded shadow-sm border border-amber-400">
                  {highlightedText}
                </mark>
                <span className="text-slate-400">{afterText}</span>
              </span>
            ) : (
              <div>
                <p className="text-rose-300 mb-2">
                  [Note: Quote was not matched with exact character offsets]
                </p>
                <p className="text-slate-300 whitespace-pre-wrap">{sourceText}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
