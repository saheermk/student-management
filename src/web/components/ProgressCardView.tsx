import React from 'react';
import { ProgressCardDTO } from '../../shared/types';
import { PrinterIcon } from './Icons';
import { useInstitution } from '../context/InstitutionContext';

interface ProgressCardViewProps {
  card: ProgressCardDTO;
  onClose?: () => void;
}

export const ProgressCardView: React.FC<ProgressCardViewProps> = ({ card, onClose }) => {
  const { institutionName: ctxName, logoUrl } = useInstitution();
  const displayTitle = card.institutionName || ctxName;

  const handlePrint = () => {
    window.print();
  };

  const isPass = card.result === 'PASS';

  return (
    <div className="space-y-4">
      {/* Top Action Bar (Hidden on Print) */}
      <div className="flex items-center justify-between print:hidden bg-slate-100 p-3 rounded-xl border border-slate-200/80">
        <span className="text-xs font-semibold text-slate-600">Progress Card Preview</span>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer"
          >
            <PrinterIcon className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Print Printable Container */}
      <div
        id="printable-progress-card"
        className="bg-white border-2 border-slate-800 rounded-xl p-8 sm:p-10 shadow-lg print:shadow-none print:border-2 print:border-black print:p-6 text-slate-900 font-sans max-w-4xl mx-auto"
      >
        {/* Header Block */}
        <div className="text-center space-y-2 border-b-2 border-slate-800 pb-6 mb-6 relative">
          {logoUrl && (
            <div className="sm:absolute sm:left-0 sm:top-0 w-14 h-14 mx-auto mb-2 sm:mb-0 flex items-center justify-center">
              <img src={logoUrl} alt={displayTitle} className="max-h-full max-w-full object-contain" />
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-slate-900 font-serif">
            {displayTitle}
          </h1>
          <p className="text-xl font-bold font-serif text-slate-800 dir-rtl">
            {card.arabicHeader || 'مدرسة حياة الإسلام'}
          </p>
          <div className="inline-block px-4 py-1 bg-slate-100 print:bg-slate-200 text-slate-900 rounded-md font-bold text-xs sm:text-sm tracking-wide uppercase border border-slate-300">
            {card.examTitle}
          </div>
        </div>


        {/* Student Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 print:bg-slate-100 p-4 rounded-lg border border-slate-300 mb-6 text-xs sm:text-sm">
          <div>
            <span className="text-slate-500 text-xs font-semibold block uppercase">Student Name</span>
            <span className="font-extrabold text-slate-900 block">{card.student.name}</span>
          </div>
          <div>
            <span className="text-slate-500 text-xs font-semibold block uppercase">Admission No</span>
            <span className="font-extrabold text-slate-900 block font-mono">{card.student.admissionNo}</span>
          </div>
          <div>
            <span className="text-slate-500 text-xs font-semibold block uppercase">Class / Grade</span>
            <span className="font-extrabold text-slate-900 block">{card.student.className}</span>
          </div>
          <div>
            <span className="text-slate-500 text-xs font-semibold block uppercase">Date Issued</span>
            <span className="font-extrabold text-slate-900 block">{card.generatedDate}</span>
          </div>
        </div>

        {/* Examination Results Grid */}
        <div className="mb-6 overflow-hidden border border-slate-800 rounded-lg">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-800 text-white font-bold uppercase text-xs">
                <th className="px-3 py-2.5 w-12 text-center border-r border-slate-700">#</th>
                <th className="px-4 py-2.5 border-r border-slate-700">Subject Name</th>
                <th className="px-4 py-2.5 text-center border-r border-slate-700">Max Marks</th>
                <th className="px-4 py-2.5 text-center border-r border-slate-700">Marks Obtained</th>
                <th className="px-4 py-2.5 text-center border-r border-slate-700">Grade</th>
                <th className="px-4 py-2.5 text-center">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {card.subjects.map((sub) => (
                <tr key={sub.subjectId} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-center font-bold text-slate-500 border-r border-slate-300">
                    {sub.sNo}
                  </td>
                  <td className="px-4 py-2.5 font-bold text-slate-900 border-r border-slate-300">
                    {sub.subjectName}
                  </td>
                  <td className="px-4 py-2.5 text-center font-medium border-r border-slate-300">
                    {sub.maxMarks}
                  </td>
                  <td className="px-4 py-2.5 text-center font-extrabold text-slate-900 border-r border-slate-300">
                    {sub.marksObtained}
                  </td>
                  <td className="px-4 py-2.5 text-center font-black border-r border-slate-300 text-slate-900">
                    {sub.grade}
                  </td>
                  <td className="px-4 py-2.5 text-center font-extrabold">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs uppercase ${
                        sub.isPass ? 'text-emerald-800 font-extrabold' : 'text-rose-800 font-extrabold'
                      }`}
                    >
                      {sub.isPass ? 'PASS' : 'FAIL'}
                    </span>
                  </td>
                </tr>
              ))}

              {/* Grand Total Row */}
              <tr className="bg-slate-100 font-black border-t-2 border-slate-800 text-slate-900">
                <td colSpan={2} className="px-4 py-3 text-right uppercase tracking-wider border-r border-slate-300">
                  Grand Total
                </td>
                <td className="px-4 py-3 text-center border-r border-slate-300 font-bold">{card.grandTotalMax}</td>
                <td className="px-4 py-3 text-center text-indigo-900 font-black border-r border-slate-300">
                  {card.grandTotalObtained}
                </td>
                <td className="px-4 py-3 text-center font-black text-slate-900 border-r border-slate-300">
                  {card.grandTotalGrade}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-black text-xs uppercase ${isPass ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {card.result}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Attendance Summary Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 print:bg-slate-100 p-4 rounded-lg border border-slate-300 mb-6 text-xs sm:text-sm">
          <div className="flex items-center space-x-2 font-bold text-slate-700">
            <span>ATTENDANCE RECORD:</span>
            <span className="text-slate-900">
              {card.attendanceSummary.attendedDays} / {card.attendanceSummary.totalDays} Days Attended
            </span>
          </div>
          <div className="font-extrabold text-indigo-900 mt-1 sm:mt-0">
            Attendance Rate: <span className="text-slate-900">{card.attendanceSummary.percentage}%</span>
          </div>
        </div>

        {/* Final Status Banner */}
        <div
          className={`p-5 rounded-xl border-2 mb-8 text-center space-y-1 ${
            isPass
              ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
              : 'bg-rose-50 border-rose-600 text-rose-950'
          }`}
        >
          <div className="text-xs font-black tracking-widest uppercase text-slate-500">FINAL EVALUATION RESULT</div>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-1">
            <div>
              <span className="text-xs font-bold block text-slate-500 uppercase">STATUS</span>
              <span className={`text-2xl font-black uppercase ${isPass ? 'text-emerald-700' : 'text-rose-700'}`}>
                {card.result}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-300 hidden sm:block"></div>
            <div>
              <span className="text-xs font-bold block text-slate-500 uppercase">CLASS RANK</span>
              <span className="text-2xl font-black text-slate-900">{card.rank}</span>
            </div>
            <div className="h-8 w-px bg-slate-300 hidden sm:block"></div>
            <div>
              <span className="text-xs font-bold block text-slate-500 uppercase">OVERALL PERCENTAGE</span>
              <span className="text-2xl font-black text-slate-900">{card.overallPercentage}%</span>
            </div>
            <div className="h-8 w-px bg-slate-300 hidden sm:block"></div>
            <div>
              <span className="text-xs font-bold block text-slate-500 uppercase">GRADE CLASSIFICATION</span>
              <span className="text-lg font-bold text-slate-800">{card.classification}</span>
            </div>
          </div>
        </div>

        {/* Signatures Block */}
        <div className="grid grid-cols-3 gap-4 pt-12 text-center text-xs font-bold text-slate-800">
          <div>
            <div className="border-t border-slate-800 pt-2">Class Teacher Signature</div>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-2">Parent / Guardian Signature</div>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-2">Principal Signature & Stamp</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressCardView;
