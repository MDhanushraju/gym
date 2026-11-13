import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, XCircle, Eye, Compass } from 'lucide-react';

export default function BiomechanicalTable({ comparisonRows = [] }) {
  const [activeSideFilter, setActiveSideFilter] = useState('all'); // 'all' | 'front' | 'back'

  const statusBadges = {
    Correct: {
      style: 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
    },
    'Needs improvement': {
      style: 'bg-[#FFF8E1] text-[#D97706] border-[#FFE082]',
      icon: <AlertCircle className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
    },
    Incorrect: {
      style: 'bg-[#FFEBEE] text-[#D32F2F] border-[#FFCDD2]',
      icon: <XCircle className="w-3.5 h-3.5 text-[#D32F2F] shrink-0" />
    }
  };

  const filteredRows = comparisonRows.filter(row => {
    if (activeSideFilter === 'all') return true;
    if (activeSideFilter === 'front') return row.side === 'front';
    if (activeSideFilter === 'back') return row.side === 'back';
    return true;
  });

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-[#FFFFFF] border border-[#E2D9F3] shadow-sm">
      
      {/* Perspective Filter Tabs: Front (Primary) vs Back (Optional) */}
      <div className="p-4 border-b border-[#E2D9F3] bg-[#FFFFFF] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#7F00FF]" />
          <span className="text-xs font-bold text-[#2F3159]">Observation Perspective:</span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#FFFFFF] p-1 rounded-full border border-[#E2D9F3]">
          <button
            onClick={() => setActiveSideFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              activeSideFilter === 'all'
                ? 'bg-[#2F3159] text-white shadow-sm'
                : 'text-[#696C92] hover:text-[#2F3159]'
            }`}
          >
            All Perspectives ({comparisonRows.length})
          </button>

          <button
            onClick={() => setActiveSideFilter('front')}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
              activeSideFilter === 'front'
                ? 'bg-[#7F00FF] text-white shadow-sm'
                : 'text-[#696C92] hover:text-[#2F3159]'
            }`}
          >
            <span>Front View</span>
            <span className="text-[10px] px-1 rounded-full bg-[#FFFFFF]/30">Primary</span>
          </button>

          <button
            onClick={() => setActiveSideFilter('back')}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
              activeSideFilter === 'back'
                ? 'bg-[#7F00FF] text-white shadow-sm'
                : 'text-[#696C92] hover:text-[#2F3159]'
            }`}
          >
            <span>Back View</span>
            <span className="text-[10px] px-1 rounded-full bg-[#FFF8E1] text-[#D97706]">Optional</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2D9F3] bg-[#F3F0FF] text-[11px] font-semibold uppercase tracking-wider text-[#696C92]">
              <th className="py-4 px-6">Body Region & Perspective</th>
              <th className="py-4 px-6">Movement Standard</th>
              <th className="py-4 px-6">Observed Movement</th>
              <th className="py-4 px-6 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2D9F3] text-xs sm:text-sm">
            {filteredRows.map((row, idx) => {
              const badge = statusBadges[row.status] || statusBadges['Correct'];
              return (
                <tr 
                  key={idx}
                  className="hover:bg-[#FFFFFF] transition-colors"
                >
                  {/* Anatomical Region & Perspective Tag */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#2F3159] whitespace-nowrap">
                        {row.bodyPart}
                      </span>
                      {row.side === 'front' ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#2F3159]">
                          Front View
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FFF8E1] text-[#D97706] border border-[#FFE082]">
                          Back View (Optional)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Reference Movement */}
                  <td className="py-4 px-6 text-[#2F3159]">
                    <span className="text-[#16A34A] font-mono text-[11px] mr-1.5 font-bold">●</span>
                    {row.referenceMovement}
                  </td>

                  {/* User Movement */}
                  <td className="py-4 px-6 text-[#696C92]">
                    <span className={`font-mono text-[11px] mr-1.5 font-bold ${
                      row.status === 'Correct' ? 'text-[#16A34A]' : row.status === 'Incorrect' ? 'text-[#D32F2F]' : 'text-[#D97706]'
                    }`}>●</span>
                    {row.yourMovement}
                  </td>

                  {/* Status Badge */}
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.style}`}>
                      {badge.icon}
                      <span>{row.status}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
