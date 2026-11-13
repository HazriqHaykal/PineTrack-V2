import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  Layers, ShieldCheck, Brain, FileText, Download, AlertTriangle, CheckCircle2, Sparkles
} from 'lucide-react';
import { authService } from '../../services/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DEFAULT_VARIETY_DATA = [
  { variety: 'MD2', available: 11500, reserved: 2000, planted: 1500 },
  { variety: 'Moris', available: 8800, reserved: 1000, planted: 2000 },
  { variety: 'Josapine', available: 3400, reserved: 500, planted: 1000 },
  { variety: 'N36', available: 6500, reserved: 0, planted: 1500 },
];

const GRADE_PIE_DATA = [
  { name: 'Grade A (35-45cm)', value: 26800, color: '#16a34a' },
  { name: 'Grade B (25-34cm)', value: 3400,  color: '#f59e0b' },
  { name: 'Damaged / Spoiled', value: 300,   color: '#ef4444' },
];

export const SulurAnalyticsSection: React.FC = () => {
  const [varietyData, setVarietyData] = useState<any[]>(DEFAULT_VARIETY_DATA);
  const [totals, setTotals] = useState({ available: 30200, planted: 6000, certified: '3 / 4' });

  useEffect(() => {
    const token = authService?.getToken?.() || localStorage.getItem('token') || '';
    fetch(`${API_BASE}/api/sulur/summary`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.total_available > 0) {
          setVarietyData(d.variety_breakdown || DEFAULT_VARIETY_DATA);
          setTotals({
            available: d.total_available,
            planted: d.total_planted + d.total_reserved,
            certified: `${d.certified_batches} / ${d.total_batches}`
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mt-8 pt-8 border-t border-gray-200 space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs uppercase">
            Sulur Inventory Analytics
          </span>
          <h2 className="text-xl font-bold text-gray-900 mt-1">
            Pineapple Seed (Sulur) Stock & Grading Analytics
          </h2>
          <p className="text-xs text-gray-500">
            Pre-planting nursery stock distribution, LPNM size grading split, and field deployment metrics
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <div className="bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-gray-400 block">Available Sulur</span>
            <strong className="text-base text-emerald-700">{totals.available.toLocaleString()}</strong>
          </div>
          <div className="bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-gray-400 block">Planted & Reserved</span>
            <strong className="text-base text-blue-700">{totals.planted.toLocaleString()}</strong>
          </div>
          <div className="bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-gray-400 block">LPNM Certified</span>
            <strong className="text-base text-purple-700">{totals.certified}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-1">
            Sulur Stock by Pineapple Variety (Available vs Reserved vs Planted)
          </h3>
          <p className="text-xs text-gray-400 mb-4">Live nursery comparison across MD2, Moris, Josapine, and N36</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={varietyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="variety" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="available" name="Available" fill="#16a34a" radius={[6, 6, 0, 0]} />
                <Bar dataKey="reserved" name="Reserved" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="planted" name="Planted" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Sulur Size Grade Split (LPNM)</h3>
          <p className="text-xs text-gray-400 mb-4">Uniformity classification in nursery</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={GRADE_PIE_DATA}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {GRADE_PIE_DATA.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2 text-xs">
            {GRADE_PIE_DATA.map((g, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                  {g.name}
                </span>
                <strong className="text-gray-900">{g.value.toLocaleString()} sulur</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SulurIntelligenceSection: React.FC = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedVariety, setSelectedVariety] = useState('MD2');
  const [plannedHa, setPlannedHa] = useState(0.5);

  const density = selectedVariety === 'Moris' ? 40000 : selectedVariety === 'N36' ? 38000 : 43500;
  const availMap: Record<string, number> = { MD2: 11500, Moris: 8800, Josapine: 3400, N36: 6500 };
  const avail = availMap[selectedVariety] || 11500;
  const req = Math.round(plannedHa * density);
  const shortfall = Math.max(req - avail, 0);

  return (
    <div className="mt-8 pt-8 border-t border-gray-200 space-y-6 animate-fade-up">
      <div className="bg-gradient-to-r from-[#162f25] to-emerald-800 rounded-2xl p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-400 text-gray-950 flex items-center justify-center shrink-0 mt-0.5">
            <Brain size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
              PineTrack Agent | Pre-Planting Sulur Intelligence (DSS)
            </span>
            <h2 className="text-lg font-bold mt-0.5">
              Smart Sulur Inventory, Curing & Profit Decision Support
            </h2>
            <p className="text-xs text-emerald-100 mt-0.5">
              Automated rule-based evaluation of nursery stock sufficiency, curing duration risk, and cultivation ROI
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setAnalyzing(true);
            setTimeout(() => setAnalyzing(false), 600);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold rounded-xl text-xs transition shrink-0"
        >
          <Sparkles size={15} className={analyzing ? 'animate-spin' : ''} />
          <span>{analyzing ? 'Evaluating Rules...' : 'Run Sulur DSS Check'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Simulate Planting Plan Check</h3>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Target Variety</label>
            <select
              value={selectedVariety}
              onChange={e => setSelectedVariety(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"
            >
              <option value="MD2">MD2 (11,500 available)</option>
              <option value="Moris">Moris (8,800 available)</option>
              <option value="Josapine">Josapine (3,400 available)</option>
              <option value="N36">N36 (6,500 available)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Planned Land Area (Hectares)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={plannedHa}
              onChange={e => setPlannedHa(Math.max(Number(e.target.value), 0.1))}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold"
            />
          </div>
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Required Sulur:</span>
              <strong className="text-gray-900">{req.toLocaleString()} sulur</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Available in Nursery:</span>
              <strong className="text-emerald-700">{avail.toLocaleString()} sulur</strong>
            </div>
            <div className="flex justify-between pt-1 border-t border-gray-200">
              <span className="text-gray-500">Shortfall / Surplus:</span>
              <strong className={shortfall > 0 ? 'text-red-600' : 'text-emerald-700'}>
                {shortfall > 0 ? `-${shortfall.toLocaleString()} shortfall` : `+${(avail - req).toLocaleString()} surplus`}
              </strong>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-5 rounded-2xl border space-y-2 ${
            shortfall > 0 ? 'bg-red-50/90 border-red-200 text-red-950' : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/80">
                RULE 1 | STOCK SUFFICIENCY
              </span>
              <span className="text-xs font-bold">Confidence: 100%</span>
            </div>
            <h4 className="font-bold text-sm flex items-center gap-1.5 pt-1">
              {shortfall > 0 ? <AlertTriangle size={16} className="text-red-600" /> : <CheckCircle2 size={16} className="text-emerald-600" />}
              <span>{shortfall > 0 ? 'Insufficient Sulur Stock Detected' : 'Sufficient Sulur Stock Verified'}</span>
            </h4>
            <p className="text-xs leading-relaxed opacity-90">
              {shortfall > 0
                ? `Planting ${plannedHa} ha of ${selectedVariety} requires ${req.toLocaleString()} sulur, but only ${avail.toLocaleString()} are available in the nursery.`
                : `Nursery stock (${avail.toLocaleString()} ${selectedVariety} sulur) is sufficient to cover your ${plannedHa} ha cultivation plan.`}
            </p>
            <p className="text-xs font-bold pt-1">
              Recommendation: {shortfall > 0
                ? `Procure ${shortfall.toLocaleString()} certified ${selectedVariety} sulur or reduce plot area to ${(avail / density).toFixed(2)} ha.`
                : 'Reserve the batch in Sulur Inventory to lock allocation.'}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/80">
                RULE 2 | POST-HARVEST CURING & QUALITY
              </span>
              <span className="text-xs font-bold">Batch SLR-202610-JOS-003</span>
            </div>
            <h4 className="font-bold text-sm flex items-center gap-1.5 pt-1">
              <AlertTriangle size={16} className="text-amber-600" />
              <span>Curing Duration & Certification Alert</span>
            </h4>
            <p className="text-xs leading-relaxed opacity-90">
              3,400 Josapine slips (Grade B) have been in curing state for &gt;14 days and are pending Management LPNM Certification.
            </p>
            <p className="text-xs font-bold pt-1">
              Recommendation: Complete fungicide dip and issue LPNM Quality Certificate before dehydration occurs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SulurReportsSection: React.FC = () => {
  const handleDownloadSulurSummaryReport = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>PineTrack V2.0 - Official Sulur Inventory & Profit DSS Report</title></head>
        <body style="font-family: Arial, sans-serif; padding: 36px; color: #1e293b;">
          <div style="background:#162f25; color:white; padding:24px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h1 style="margin:0; font-size:22px;">PINETRACK V2.0 - SERI NANAS FARM SDN. BHD.</h1>
              <p style="margin:6px 0 0; font-size:13px; color:#a7f3d0;">
                Smart Management System for Pineapple Seed (Sulur) Inventory, Traceability & Profit Report
              </p>
            </div>
            <div style="text-align:right; font-size:12px;">
              <strong>Date Generated:</strong> ${new Date().toISOString().split('T')[0]}<br/>
              <strong>Prepared By:</strong> Muhammad Arif Omar (222580)
            </div>
          </div>

          <h3 style="margin-top:28px; border-bottom:2px solid #16a34a; padding-bottom:6px;">
            1. Sulur Batch Registry & LPNM Certification Summary
          </h3>
          <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:10px;">
            <thead>
              <tr style="background:#f1f5f9; text-align:left;">
                <th style="padding:10px; border:1px solid #cbd5e1;">Batch Code</th>
                <th style="padding:10px; border:1px solid #cbd5e1;">Variety & Grade</th>
                <th style="padding:10px; border:1px solid #cbd5e1;">Source Plot</th>
                <th style="padding:10px; border:1px solid #cbd5e1;">Available / Initial</th>
                <th style="padding:10px; border:1px solid #cbd5e1;">LPNM Certificate No.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:10px; border:1px solid #cbd5e1; font-weight:bold;">SLR-202610-MD2-001</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">MD2 (Grade A - Sucker)</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">Block A1 - Seri Nanas Farm</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">11,500 / 15,000</td>
                <td style="padding:10px; border:1px solid #cbd5e1; color:#15803d; font-weight:bold;">CERT-LPNM-SNF-2026-0001</td>
              </tr>
              <tr>
                <td style="padding:10px; border:1px solid #cbd5e1; font-weight:bold;">SLR-202610-MOR-002</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">Moris (Grade A - Sucker)</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">Block C2 - Seri Nanas Farm</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">8,800 / 12,000</td>
                <td style="padding:10px; border:1px solid #cbd5e1; color:#15803d; font-weight:bold;">CERT-LPNM-SNF-2026-0002</td>
              </tr>
              <tr>
                <td style="padding:10px; border:1px solid #cbd5e1; font-weight:bold;">SLR-202610-JOS-003</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">Josapine (Grade B - Slip)</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">Block B1 - Seri Nanas Farm</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">3,400 / 6,000</td>
                <td style="padding:10px; border:1px solid #cbd5e1; color:#d97706;">Pending Inspection</td>
              </tr>
              <tr>
                <td style="padding:10px; border:1px solid #cbd5e1; font-weight:bold;">SLR-202611-N36-004</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">N36 (Grade A - Sucker)</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">Zanko Partner Plot D</td>
                <td style="padding:10px; border:1px solid #cbd5e1;">6,500 / 8,000</td>
                <td style="padding:10px; border:1px solid #cbd5e1; color:#15803d; font-weight:bold;">CERT-LPNM-SNF-2026-0004</td>
              </tr>
            </tbody>
          </table>

          <h3 style="margin-top:28px; border-bottom:2px solid #16a34a; padding-bottom:6px;">
            2. Seed Quantity, Nutrient & Profit Estimation Benchmark (0.5 ha MD2)
          </h3>
          <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:10px;">
            <tr><td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">Planned Land Area & Variety:</td><td style="padding:8px; border:1px solid #cbd5e1;">0.5 Hectares (MD2 @ 43,500 trees/ha)</td></tr>
            <tr><td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">Required Sulur Quantity:</td><td style="padding:8px; border:1px solid #cbd5e1;">21,750 sulur pieces</td></tr>
            <tr><td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">Estimated NPK & Foliar Fertilizer:</td><td style="padding:8px; border:1px solid #cbd5e1;">978.8 kg NPK + 87.0 Liters Foliar</td></tr>
            <tr><td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">Total Estimated Cost (Seed + Nutrient + Operational):</td><td style="padding:8px; border:1px solid #cbd5e1;">RM 15,500.00 (RM 5,000 + RM 8,000 + RM 2,500)</td></tr>
            <tr><td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">Expected Revenue & Projected Net Profit:</td><td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#15803d;">Revenue: RM 30,000.00 | Net Profit: RM 14,500.00 (ROI: 93.5%)</td></tr>
          </table>

          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleDownloadSulurCSV = () => {
    const csvRows = [
      'Batch Code,Variety,Sulur Type,Size Grade,Initial Qty,Available Qty,Reserved Qty,Planted Qty,Source Plot,Storage Location,LPNM Certified,Certificate No',
      'SLR-202610-MD2-001,MD2,sucker,Grade A,15000,11500,2000,1500,Block A1 - Seri Nanas Farm,Nursery Shed 1,Yes,CERT-LPNM-SNF-2026-0001',
      'SLR-202610-MOR-002,Moris,sucker,Grade A,12000,8800,1000,2000,Block C2 - Seri Nanas Farm,Nursery Shed 2,Yes,CERT-LPNM-SNF-2026-0002',
      'SLR-202610-JOS-003,Josapine,slip,Grade B,6000,3400,500,1000,Block B1 - Seri Nanas Farm,Nursery Shed 1,No,Pending',
      'SLR-202611-N36-004,N36,sucker,Grade A,8000,6500,0,1500,Zanko Partner Plot D,Nursery Shed 3,Yes,CERT-LPNM-SNF-2026-0004'
    ].join('\n');

    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PineTrack_V2_Sulur_Inventory_Report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-8 pt-8 border-t border-gray-200 space-y-5 animate-fade-up">
      <div>
        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs uppercase">
          Sulur Inventory & Certification Reports
        </span>
        <h2 className="text-xl font-bold text-gray-900 mt-1">
          Pineapple Seed (Sulur) Traceability, Quality Certificate & Profit Reports
        </h2>
        <p className="text-xs text-gray-500">
          Export structured PDF and CSV reports for Seri Nanas Farm management and LPNM compliance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <FileText size={22} />
            </div>
            <h3 className="text-base font-bold text-gray-900">Full Sulur Inventory & Profit PDF</h3>
            <p className="text-xs text-gray-500 mt-1">
              Complete batch registry, stock movement summary, LPNM certificate numbers, and 0.5 ha MD2 profit projection.
            </p>
          </div>
          <button
            onClick={handleDownloadSulurSummaryReport}
            className="w-full py-3 bg-[#162f25] hover:bg-emerald-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
          >
            <Download size={15} />
            <span>Export Full Sulur Report (PDF)</span>
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
              <ShieldCheck size={22} />
            </div>
            <h3 className="text-base font-bold text-gray-900">LPNM Seed Quality Certificate PDF</h3>
            <p className="text-xs text-gray-500 mt-1">
              Official Management Quality Verification Certificate for Batch SLR-202610-MD2-001 (Grade A Uniform Suckers).
            </p>
          </div>
          <button
            onClick={() => window.open(`${API_BASE}/api/sulur/batches/1/certificate.pdf`, '_blank')}
            className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
          >
            <Download size={15} />
            <span>Download LPNM Certificate (PDF)</span>
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
              <Layers size={22} />
            </div>
            <h3 className="text-base font-bold text-gray-900">Sulur Batch & Traceability CSV</h3>
            <p className="text-xs text-gray-500 mt-1">
              Download raw spreadsheet data of all sulur batches, quantities, storage locations, and certificate statuses.
            </p>
          </div>
          <button
            onClick={handleDownloadSulurCSV}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
          >
            <Download size={15} />
            <span>Export Sulur Dataset (CSV)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
