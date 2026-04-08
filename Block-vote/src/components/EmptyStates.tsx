import { SVGProps } from 'react';

/**
 * Empty-state illustration: Ballot Box
 * Used when there are no elections or no items to display.
 */
export function EmptyBallotBox(props: SVGProps<SVGSVGElement> & { size?: number }) {
  const s = props.size || 120;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={s} height={s} viewBox="0 0 120 120" fill="none" {...props}>
      {/* box body */}
      <rect x="20" y="44" width="80" height="56" rx="8" stroke="#374151" strokeWidth="2.5" />
      {/* box lid */}
      <path d="M16 44h88" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
      {/* slot */}
      <rect x="42" y="44" width="36" height="6" rx="3" fill="#1F2937" stroke="#4B5563" strokeWidth="1.5" />
      {/* ballot paper */}
      <g>
        <rect x="48" y="18" width="24" height="32" rx="3" fill="#1F2937" stroke="#22C55E" strokeWidth="2" />
        <path d="M54 30l4 4 8-8" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* decorative dots */}
      <circle cx="35" cy="72" r="2" fill="#374151" />
      <circle cx="60" cy="78" r="2" fill="#374151" />
      <circle cx="85" cy="72" r="2" fill="#374151" />
    </svg>
  );
}

/**
 * Empty-state illustration: No Search Results
 * Used when search/filter yields no matching records.
 */
export function EmptySearchResults(props: SVGProps<SVGSVGElement> & { size?: number }) {
  const s = props.size || 120;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={s} height={s} viewBox="0 0 120 120" fill="none" {...props}>
      {/* magnifying glass */}
      <circle cx="52" cy="52" r="24" stroke="#374151" strokeWidth="2.5" />
      <line x1="70" y1="70" x2="96" y2="96" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
      {/* question mark */}
      <path d="M46 45c0-4 3-7 7-7s7 3 7 7c0 3-2 5-4 6-1 .5-2 1.5-2 3" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
      <circle cx="54" cy="62" r="1.5" fill="#6B7280" />
    </svg>
  );
}

/**
 * Empty-state illustration: No Candidates
 * Used when an election has no candidates yet.
 */
export function EmptyCandidates(props: SVGProps<SVGSVGElement> & { size?: number }) {
  const s = props.size || 120;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={s} height={s} viewBox="0 0 120 120" fill="none" {...props}>
      {/* podium */}
      <rect x="18" y="68" width="26" height="32" rx="3" stroke="#374151" strokeWidth="2" />
      <rect x="47" y="54" width="26" height="46" rx="3" stroke="#374151" strokeWidth="2" />
      <rect x="76" y="74" width="26" height="26" rx="3" stroke="#374151" strokeWidth="2" />
      {/* numbers */}
      <text x="31" y="88" textAnchor="middle" fill="#4B5563" fontSize="14" fontWeight="700">2</text>
      <text x="60" y="78" textAnchor="middle" fill="#4B5563" fontSize="14" fontWeight="700">1</text>
      <text x="89" y="92" textAnchor="middle" fill="#4B5563" fontSize="14" fontWeight="700">3</text>
      {/* dashed silhouettes */}
      <circle cx="60" cy="38" r="8" stroke="#374151" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="31" cy="54" r="6" stroke="#374151" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="89" cy="60" r="6" stroke="#374151" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  );
}

/**
 * Empty-state illustration: No Transactions
 * Used when the transaction history page has no records.
 */
export function EmptyTransactions(props: SVGProps<SVGSVGElement> & { size?: number }) {
  const s = props.size || 120;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={s} height={s} viewBox="0 0 120 120" fill="none" {...props}>
      {/* chain links */}
      <rect x="24" y="40" width="28" height="16" rx="8" stroke="#374151" strokeWidth="2" />
      <rect x="44" y="52" width="28" height="16" rx="8" stroke="#374151" strokeWidth="2" />
      <rect x="64" y="64" width="28" height="16" rx="8" stroke="#374151" strokeWidth="2" />
      {/* broken link */}
      <line x1="60" y1="32" x2="66" y2="26" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
      <line x1="70" y1="28" x2="76" y2="22" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
      {/* clock */}
      <circle cx="90" cy="36" r="12" stroke="#374151" strokeWidth="1.5" />
      <path d="M90 30v6l4 3" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
