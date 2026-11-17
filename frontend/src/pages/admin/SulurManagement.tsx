import { tr, trEnum } from '../../i18n'
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Package, PlusCircle, ArrowRightLeft, Calculator, ShieldCheck,
  Sprout, TrendingUp, AlertTriangle, Download, Search, X, CheckCircle2,
  SlidersHorizontal, Droplets,ClipboardCheck, Wrench
} from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import WorkerLayout from '../../components/layout/WorkerLayout';
import { authService } from '../../services/auth';

// VITE_API_URL ends in /api (see .env.example); these calls add /api/sulur themselves
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/api\/?$/, '');

const LPNM_STANDARDS: Record<string, { density: number; npkPer1000: number; foliarPer1000: number; seedCost: number; nutCostPer1000: number; opCostHa: number; revenueHa: number }> = {
  MD2:      { density: 43500, npkPer1000: 45, foliarPer1000: 4.0, seedCost: 0.90, nutCostPer1000: 380, opCostHa: 5000, revenueHa: 60000 },
  Moris:    { density: 40000, npkPer1000: 38, foliarPer1000: 3.0, seedCost: 0.55, nutCostPer1000: 320, opCostHa: 4200, revenueHa: 45000 },
  Josapine: { density: 43500, npkPer1000: 42, foliarPer1000: 3.5, seedCost: 0.70, nutCostPer1000: 350, opCostHa: 4600, revenueHa: 52000 },
  N36:      { density: 38000, npkPer1000: 40, foliarPer1000: 3.2, seedCost: 0.65, nutCostPer1000: 340, opCostHa: 4400, revenueHa: 48000 },
};

const INITIAL_BATCHES = [
  {
    id: 1,
    batch_code: 'SLR-202610-MD2-001',
    variety: 'MD2',
    sulur_type: 'sucker',
    size_grade: 'Grade A',
    initial_quantity: 15000,
    available_quantity: 11500,
    reserved_quantity: 2000,
    planted_quantity: 1500,
    sold_quantity: 0,
    damaged_quantity: 0,
    source_plot: 'Block A1 - Seri Nanas Farm',
    storage_location: 'Nursery Shed 1',
    date_received: '2026-10-28',
    treatment_status: 'ready_to_plant',
    is_certified: true,
    certificate_number: 'CERT-LPNM-SNF-2026-0001',
    certified_by: 'Prof. Madya Dr. Rodziah / SNF Manager',
    quality_remarks: 'LPNM Grade A (35-42cm uniform suckers). Fungicide dipped & cured.'
  },
  {
    id: 2,
    batch_code: 'SLR-202610-MOR-002',
    variety: 'Moris',
    sulur_type: 'sucker',
    size_grade: 'Grade A',
    initial_quantity: 12000,
    available_quantity: 8800,
    reserved_quantity: 1000,
    planted_quantity: 2000,
    sold_quantity: 0,
    damaged_quantity: 200,
    source_plot: 'Block C2 - Seri Nanas Farm',
    storage_location: 'Nursery Shed 2',
    date_received: '2026-10-20',
    treatment_status: 'fungicide_treated',
    is_certified: true,
    certificate_number: 'CERT-LPNM-SNF-2026-0002',
    certified_by: 'SNF Quality Inspector',
    quality_remarks: 'Healthy parent plant suckers, sorted for uniform Block C planting.'
  },
  {
    id: 3,
    batch_code: 'SLR-202610-JOS-003',
    variety: 'Josapine',
    sulur_type: 'slip',
    size_grade: 'Grade B',
    initial_quantity: 6000,
    available_quantity: 3400,
    reserved_quantity: 500,
    planted_quantity: 1000,
    sold_quantity: 1000,
    damaged_quantity: 100,
    source_plot: 'Block B1 - Seri Nanas Farm',
    storage_location: 'Nursery Shed 1',
    date_received: '2026-10-15',
    treatment_status: 'curing',
    is_certified: false,
    quality_remarks: '25-32cm slips currently in curing phase; pending final LPNM grading sign-off.'
  },
  {
    id: 4,
    batch_code: 'SLR-202611-N36-004',
    variety: 'N36',
    sulur_type: 'sucker',
    size_grade: 'Grade A',
    initial_quantity: 8000,
    available_quantity: 6500,
    reserved_quantity: 0,
    planted_quantity: 1500,
    sold_quantity: 0,
    damaged_quantity: 0,
    source_plot: 'Zanko Partner Plot D',
    storage_location: 'Nursery Shed 3',
    date_received: '2026-11-02',
    treatment_status: 'ready_to_plant',
    is_certified: true,
    certificate_number: 'CERT-LPNM-SNF-2026-0004',
    certified_by: 'Muhammad Arif Omar',
    quality_remarks: 'Verified uniform Grade A N36 suckers ready for field cultivation.'
  }
];

const INITIAL_MOVEMENTS = [
  { id: 1, batch_id: 1, batch_code: 'SLR-202610-MD2-001', movement_type: 'stock_in', quantity: 15000, destination_or_plot: 'Nursery Shed 1', movement_date: '2026-10-28', remarks: 'Initial harvest of Grade A MD2 suckers from Block A1' },
  { id: 2, batch_id: 1, batch_code: 'SLR-202610-MD2-001', movement_type: 'plant', quantity: 1500, destination_or_plot: 'Plot B2 - MD2 Expansion', movement_date: '2026-11-01', remarks: 'Issued to field team for bed planting' },
  { id: 3, batch_id: 1, batch_code: 'SLR-202610-MD2-001', movement_type: 'reserve', quantity: 2000, destination_or_plot: 'Plot B3 - Scheduled Next Week', movement_date: '2026-11-05', remarks: 'Reserved for upcoming 0.5 ha MD2 cultivation plan' },
  { id: 4, batch_id: 2, batch_code: 'SLR-202610-MOR-002', movement_type: 'plant', quantity: 2000, destination_or_plot: 'Plot C4 - Moris Zone', movement_date: '2026-11-03', remarks: 'Planted uniform Grade A Moris batch' },
  { id: 5, batch_id: 3, batch_code: 'SLR-202610-JOS-003', movement_type: 'sell', quantity: 1000, destination_or_plot: 'Smallholder Cooperative Johor', movement_date: '2026-11-06', remarks: 'Sold excess Grade B Josapine slips at LPNM reference rate' },
];

type SimpleTabKey = 'stock' | 'movements' | 'planner';

export const SulurManagementContent: React.FC<{ isWorker: boolean }> = ({ isWorker }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromPath = (p: string): SimpleTabKey => {
    if (p.endsWith('/movements')) return 'movements';
    if (p.endsWith('/planner')) return 'planner';
    return 'stock';
  };

  const [activeTab, setActiveTab] = useState<SimpleTabKey>(() => getTabFromPath(location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  const switchTab = (tab: SimpleTabKey) => {
    setActiveTab(tab);
    navigate(`${isWorker ? '/worker/sulur' : '/admin/sulur'}/${tab}`);
  };

  const [batches, setBatches] = useState<any[]>(INITIAL_BATCHES);
  const [movements, setMovements] = useState<any[]>(INITIAL_MOVEMENTS);
  const [varietyFilter, setVarietyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [moveModalBatch, setMoveModalBatch] = useState<any | null>(null);

  const [newBatch, setNewBatch] = useState({
    variety: 'MD2',
    sulur_type: 'sucker',
    size_grade: 'Grade A',
    initial_quantity: 10000,
    source_plot: 'Block A - Seri Nanas Farm',
    storage_location: 'Nursery Shed 1',
    date_received: new Date().toISOString().split('T')[0],
    treatment_status: 'ready_to_plant',
    is_certified: !isWorker,
    quality_remarks: 'LPNM Grade A uniform suckers (35-45cm).'
  });

  const [moveForm, setMoveForm] = useState({
    movement_type: 'plant',
    quantity: 1000,
    destination_or_plot: 'Plot B2 - Field Cultivation',
    remarks: 'Issued for field planting'
  });

  const [calcVariety, setCalcVariety] = useState<string>('MD2');
  const [calcAreaHa, setCalcAreaHa] = useState<number>(0.5);
  const [showAdvancedRates, setShowAdvancedRates] = useState<boolean>(false);
  const [customSulurCost, setCustomSulurCost] = useState<number>(5000);
  const [customNutrientCost, setCustomNutrientCost] = useState<number>(8000);
  const [customOpCost, setCustomOpCost] = useState<number>(2500);
  const [customRevenue, setCustomRevenue] = useState<number>(30000);

  const getHeaders = () => {
    const token =
      authService?.getToken?.() ||
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('pinetrack_token') ||
      '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const fetchBackendData = async () => {
    try {
      const headers = getHeaders();
      const [batchRes, movRes] = await Promise.all([
        fetch(`${API_BASE}/api/sulur/batches`, { headers }),
        fetch(`${API_BASE}/api/sulur/movements`, { headers })
      ]);
      if (batchRes.ok) {
        const bData = await batchRes.json();
        if (bData.items?.length > 0) setBatches(bData.items);
      }
      if (movRes.ok) {
        const mData = await movRes.json();
        if (mData?.length > 0) setMovements(mData);
      }
    } catch {}
  };

  useEffect(() => {
    fetchBackendData();
  }, []);

  const handleAreaOrVarietyChange = (newVar: string, newArea: number) => {
    setCalcVariety(newVar);
    setCalcAreaHa(newArea);
    const std = LPNM_STANDARDS[newVar] || LPNM_STANDARDS.MD2;
    if (newVar === 'MD2' && newArea === 0.5) {
      setCustomSulurCost(5000);
      setCustomNutrientCost(8000);
      setCustomOpCost(2500);
      setCustomRevenue(30000);
    } else {
      const req = Math.round(newArea * std.density);
      setCustomSulurCost(Math.round(req * 0.45 * std.seedCost));
      setCustomNutrientCost(Math.round((req / 1000) * std.nutCostPer1000));
      setCustomOpCost(Math.round(newArea * std.opCostHa));
      setCustomRevenue(Math.round(newArea * std.revenueHa));
    }
  };

  const totalAvailable = batches.reduce((a, b) => a + Number(b.available_quantity || 0), 0);
  const totalPlanted = batches.reduce((a, b) => a + Number(b.planted_quantity || 0), 0);
  const totalPlantedAndReserved = batches.reduce((a, b) => a + Number(b.planted_quantity || 0) + Number(b.reserved_quantity || 0), 0);
  const certifiedCount = batches.filter(b => b.is_certified).length;
  const readyBatchesCount = batches.filter(b => b.treatment_status === 'ready_to_plant' || b.treatment_status === 'fungicide_treated').length;

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...newBatch, is_certified: isWorker ? false : newBatch.is_certified };
    try {
      const res = await fetch(`${API_BASE}/api/sulur/batches`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchBackendData();
        setShowAddModal(false);
        return;
      }
    } catch {}
    const nextId = batches.length + 1;
    const created = {
      id: nextId,
      batch_code: `SLR-202611-${newBatch.variety.slice(0, 3).toUpperCase()}-00${nextId}`,
      ...payload,
      available_quantity: Number(newBatch.initial_quantity),
      reserved_quantity: 0,
      planted_quantity: 0,
      sold_quantity: 0,
      damaged_quantity: 0,
      certificate_number: payload.is_certified ? `CERT-LPNM-SNF-2026-000${nextId}` : undefined,
      certified_by: payload.is_certified ? 'Admin / SNF Manager' : undefined
    };
    setBatches([created, ...batches]);
    setShowAddModal(false);
  };

  const handleToggleCuringStatus = (batch: any) => {
    const nextStatus = batch.treatment_status === 'curing' ? 'ready_to_plant' : 'curing';
    setBatches(batches.map(b => b.id === batch.id ? { ...b, treatment_status: nextStatus } : b));
  };

  const handleQuickMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveModalBatch) return;
    const payload = {
      batch_id: moveModalBatch.id,
      movement_type: moveForm.movement_type,
      quantity: Number(moveForm.quantity),
      destination_or_plot: moveForm.destination_or_plot,
      remarks: moveForm.remarks
    };
    try {
      const res = await fetch(`${API_BASE}/api/sulur/movements`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchBackendData();
        setMoveModalBatch(null);
        return;
      }
    } catch {}

    const qty = Number(moveForm.quantity);
    setMovements([
      {
        id: movements.length + 1,
        batch_id: moveModalBatch.id,
        batch_code: moveModalBatch.batch_code,
        movement_type: moveForm.movement_type,
        quantity: qty,
        destination_or_plot: moveForm.destination_or_plot,
        movement_date: new Date().toISOString().split('T')[0],
        remarks: moveForm.remarks
      },
      ...movements
    ]);
    setBatches(batches.map(b => {
      if (b.id !== moveModalBatch.id) return b;
      if (moveForm.movement_type === 'plant') {
        return { ...b, available_quantity: Math.max(b.available_quantity - qty, 0), planted_quantity: b.planted_quantity + qty };
      }
      if (moveForm.movement_type === 'reserve') {
        return { ...b, available_quantity: Math.max(b.available_quantity - qty, 0), reserved_quantity: b.reserved_quantity + qty };
      }
      if (moveForm.movement_type === 'sell') {
        return { ...b, available_quantity: Math.max(b.available_quantity - qty, 0), sold_quantity: b.sold_quantity + qty };
      }
      if (moveForm.movement_type === 'damage') {
        return { ...b, available_quantity: Math.max(b.available_quantity - qty, 0), damaged_quantity: b.damaged_quantity + qty };
      }
      return { ...b, available_quantity: b.available_quantity + qty, initial_quantity: b.initial_quantity + qty };
    }));
    setMoveModalBatch(null);
  };

  const handleDownloadCertificate = async (batch: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/sulur/batches/${batch.id}/certificate.pdf`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Sulur_Certificate_${batch.batch_code}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        await fetchBackendData();
        return;
      }
    } catch {}
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html>
          <head><title>LPNM Sulur Quality Certificate - ${batch.batch_code}</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px; border: 6px double #15803d; margin: 20px;">
            <div style="background:#14532d; color:white; padding:24px; text-align:center; border-radius:8px;">
              <h1 style="margin:0;">PINETRACK V2.0 - SERI NANAS FARM SDN. BHD.</h1>
              <h3 style="margin:8px 0 0;">OFFICIAL PINEAPPLE SEED (SULUR) QUALITY & TRACEABILITY CERTIFICATE</h3>
              <p style="font-size:12px; opacity:0.9;">Aligned with Malaysian Pineapple Industry Board (LPNM / MPIB) Planting Material Standards</p>
            </div>
            <div style="text-align:center; margin: 24px 0;">
              <span style="background:#fef9c3; border:1px solid #ca8a04; color:#854d0e; padding:10px 24px; font-weight:bold; border-radius:6px;">
                CERTIFICATE NO: ${batch.certificate_number || 'CERT-LPNM-SNF-2026-VERIFIED'}
              </span>
            </div>
            <table style="width:100%; border-collapse:collapse; margin-top:20px;">
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Batch Identification Code:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.batch_code}</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Pineapple Variety:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.variety} (Ananas comosus L.)</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Sulur Type & Size Grade:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.sulur_type.toUpperCase()} - ${batch.size_grade} (Uniform Growth Standard)</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Source Plot Origin:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.source_plot}</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Nursery Storage Location:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.storage_location}</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Treatment Status:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.treatment_status.replace(/_/g, ' ').toUpperCase()}</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Available / Initial Quantity:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.available_quantity.toLocaleString()} / ${batch.initial_quantity.toLocaleString()} sulur</td></tr>
              <tr><td style="padding:12px; border-bottom:1px solid #ddd; font-weight:bold;">Inspection Remarks:</td><td style="padding:12px; border-bottom:1px solid #ddd;">${batch.quality_remarks || 'Verified healthy parent plant origin and LPNM uniform size grading.'}</td></tr>
            </table>
            <div style="margin-top:60px; display:flex; justify-content:space-between;">
              <div style="text-align:center; width:240px; border-top:1px solid #333; padding-top:8px;">
                <strong>${batch.certified_by || 'Prof. Madya Dr. Rodziah / SNF Manager'}</strong><br/><small>Authorized Quality Inspector</small>
              </div>
              <div style="text-align:center; width:240px; border-top:1px solid #333; padding-top:8px;">
                <strong>Seri Nanas Farm Sdn. Bhd.</strong><br/><small>Management Verification Stamp</small>
              </div>
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  const filteredBatches = batches.filter(b => {
    const matchVar = varietyFilter === 'ALL' || b.variety === varietyFilter;
    const matchSearch =
      !searchQuery ||
      b.batch_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.source_plot.toLowerCase().includes(searchQuery.toLowerCase());
    return matchVar && matchSearch;
  });

  const std = LPNM_STANDARDS[calcVariety] || LPNM_STANDARDS.MD2;
  const requiredSulur = Math.round(calcAreaHa * std.density);
  const availForVariety = batches
    .filter(b => b.variety === calcVariety)
    .reduce((a, b) => a + Number(b.available_quantity || 0), 0);
  const shortfall = Math.max(requiredSulur - availForVariety, 0);
  const npkNeededKg = Number(((requiredSulur / 1000) * std.npkPer1000).toFixed(1));
  const foliarNeededL = Number(((requiredSulur / 1000) * std.foliarPer1000).toFixed(1));
  const totalCost = customSulurCost + customNutrientCost + customOpCost;
  const projectedProfit = customRevenue - totalCost;
  const roiPct = totalCost > 0 ? Number(((projectedProfit / totalCost) * 100).toFixed(1)) : 0;

  // Distinct Tab Labels for Worker vs Admin
  const TABS_LIST = isWorker
    ? [
        { id: 'stock',     icon: Package,        label: tr("1. Nursery Stock & Field Issue") },
        { id: 'movements', icon: ClipboardCheck, label: tr("2. My Field Planting Log") },
        { id: 'planner',   icon: Calculator,     label: tr("3. Seed & Fertilizer Calculator") },
      ]
    : [
        { id: 'stock',     icon: Package,        label: tr("1. Stock & LPNM Certification") },
        { id: 'movements', icon: ArrowRightLeft, label: tr("2. Full Audit & Movement Ledger") },
        { id: 'planner',   icon: Calculator,     label: tr("3. Planting, Fertilizer & Profit DSS") },
      ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fade-up">
      {/* =====================================================================
          ROLE-DISTINCT HEADER BANNER FOR WORKER VS ADMIN
         ===================================================================== */}
      {isWorker && (
        <div className="bg-gradient-to-r from-green-700 to-emerald-600 rounded-2xl p-5 text-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <span className="px-2.5 py-1 bg-white/20 text-white font-bold text-[11px] rounded-full uppercase tracking-wider">
              {tr("Worker Field Mode Nursery & Planting Operations")}
            </span>
            <h1 className="text-xl font-extrabold mt-1.5">
              {tr("Sulur Nursery Stock, Curing & Field Planting Tasks")}
            </h1>
            <p className="text-xs text-green-100 mt-0.5">
              {tr("Quickly log newly harvested sulur, update fungicide/curing status, or check seed & fertilizer quantities for your plot.")}
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          CLEAN 3-TAB TOP BAR + ROLE-APPROPRIATE ACTION BUTTON
         ===================================================================== */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS_LIST.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id as SimpleTabKey)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
                  active
                    ? isWorker
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-[#162f25] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={17} className={active ? (isWorker ? 'text-white' : 'text-[#f5922a]') : 'text-gray-400'} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className={`flex items-center justify-center gap-2 px-5 py-3 text-white font-bold rounded-xl text-sm shadow-sm transition ${
            isWorker ? 'bg-green-600 hover:bg-green-700' : 'bg-emerald-700 hover:bg-emerald-800'
          }`}
        >
          <PlusCircle size={18} />
          <span>{isWorker ? tr("+ Log Harvested Sulur") : tr("+ Add New Sulur Batch")}</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: STOCK & BATCHES (Distinct KPIs & Buttons for Worker vs Admin)
         ===================================================================== */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Sprout size={28} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{tr("Available in Nursery")}</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-0.5">{totalAvailable.toLocaleString()}</p>
                <p className="text-xs text-emerald-700 font-medium mt-1">{tr("Sulur ready in nursery sheds")}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <TrendingUp size={28} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {isWorker ? tr("Planted to Field") : tr("Planted & Reserved")}
                </p>
                <p className="text-3xl font-extrabold text-gray-900 mt-0.5">
                  {(isWorker ? totalPlanted : totalPlantedAndReserved).toLocaleString()}
                </p>
                <p className="text-xs text-blue-700 font-medium mt-1">
                  {isWorker ? tr("Sulur planted by field workers") : tr("Sulur deployed or locked for farm plots")}
                </p>
              </div>
            </div>

            {isWorker ? (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Wrench size={28} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{tr("Ready-to-Plant Batches")}</p>
                  <p className="text-3xl font-extrabold text-gray-900 mt-0.5">{readyBatchesCount} {tr("of")} {batches.length} {tr("Batches")}</p>
                  <p className="text-xs text-amber-700 font-medium mt-1">{tr("1 batch currently in curing/drying")}</p>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{tr("LPNM Quality Certified")}</p>
                  <p className="text-3xl font-extrabold text-gray-900 mt-0.5">{certifiedCount} {tr("of")} {batches.length} {tr("Batches")}</p>
                  <p className="text-xs text-purple-700 font-medium mt-1">{tr("Verified uniform grading for management")}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {['ALL', 'MD2', 'Moris', 'Josapine', 'N36'].map(v => (
                <button
                  key={v}
                  onClick={() => setVarietyFilter(v)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    varietyFilter === v
                      ? 'bg-emerald-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {v === 'ALL' ? tr("All Varieties") : v}
                </button>
              ))}
            </div>

            <div className="relative sm:w-72">
              <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
              <input
                type="text"
                placeholder={tr("Search batch or plot...")}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredBatches.map(b => {
              const isReady = b.treatment_status === 'ready_to_plant' || b.treatment_status === 'fungicide_treated';
              return (
                <div
                  key={b.id}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200/80 hover:border-emerald-300 transition flex flex-col justify-between space-y-5"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-emerald-700 text-white font-extrabold text-xs">
                          {b.variety}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 font-bold text-xs">
                          {b.size_grade}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">({trEnum(b.sulur_type)})</span>
                      </div>
                      <h3 className="text-lg font-extrabold text-gray-900 mt-2">{b.batch_code}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {tr("Origin:")} <strong>{b.source_plot}</strong> {tr("| Stored at:")} <strong>{b.storage_location}</strong>
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${
                        isReady
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isReady ? tr("Ready to Plant") : tr("Curing / Drying")}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-gray-400 block">{tr("Available")}</span>
                      <span className="text-xl font-extrabold text-emerald-700">{b.available_quantity.toLocaleString()}</span>
                    </div>
                    <div className="border-x border-gray-200">
                      <span className="text-[11px] font-bold uppercase text-gray-400 block">{tr("Reserved")}</span>
                      <span className="text-xl font-extrabold text-amber-600">{b.reserved_quantity.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase text-gray-400 block">{tr("Planted")}</span>
                      <span className="text-xl font-extrabold text-blue-600">{b.planted_quantity.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Role-Distinct Action Buttons on Each Batch Card */}
                  {isWorker ? (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        onClick={() => {
                          setMoveModalBatch(b);
                          setMoveForm({
                            movement_type: 'plant',
                            quantity: 1000,
                            destination_or_plot: 'Plot B2 - Field Cultivation',
                            remarks: `Planted by worker from ${b.batch_code}`
                          });
                        }}
                        className="py-3 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
                      >
                        <Sprout size={15} />
                        <span>{tr("Take & Plant to Field")}</span>
                      </button>

                      <button
                        onClick={() => handleToggleCuringStatus(b)}
                        className="py-3 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-xs flex items-center justify-center gap-2 transition"
                      >
                        <Wrench size={15} />
                        <span>{isReady ? tr("Mark as Curing") : tr("Mark Ready to Plant")}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        onClick={() => {
                          setMoveModalBatch(b);
                          setMoveForm({
                            movement_type: 'plant',
                            quantity: 1000,
                            destination_or_plot: 'Plot B2 - Field Cultivation',
                            remarks: `Issued from ${b.batch_code}`
                          });
                        }}
                        className="py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
                      >
                        <ArrowRightLeft size={15} />
                        <span>{tr("Plant / Move Stock")}</span>
                      </button>

                      <button
                        onClick={() => handleDownloadCertificate(b)}
                        className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition ${
                          b.is_certified
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <Download size={15} />
                        <span>{b.is_certified ? tr("Certificate PDF") : tr("Certify & PDF")}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: MOVEMENT HISTORY (Worker Field Log vs Admin Full Audit Ledger)
         ===================================================================== */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {isWorker ? tr("My Field Planting & Nursery Stock Log") : tr("Full Sulur Stock Movement & Traceability Audit Ledger")}
              </h3>
              <p className="text-sm text-gray-500">
                {isWorker
                  ? tr("Recent field planting, stock-in, and damaged sulur updates")
                  : tr("Complete administrative log of every batch harvested, reserved, planted, or sold")}
              </p>
            </div>
            <button
              onClick={() => {
                setMoveModalBatch(batches[0]);
                setMoveForm({
                  movement_type: 'plant',
                  quantity: 1000,
                  destination_or_plot: 'Plot B2 - Field Cultivation',
                  remarks: 'Scheduled planting'
                });
              }}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition"
            >
              {isWorker ? tr("+ Log Field Planting") : tr("+ Record Stock Movement")}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider border-b border-gray-100">
                  <th className="py-4 px-6">{tr("Date")}</th>
                  <th className="py-4 px-6">{tr("Batch Code")}</th>
                  <th className="py-4 px-6">{tr("Action")}</th>
                  <th className="py-4 px-6">{tr("Quantity")}</th>
                  <th className="py-4 px-6">{tr("Target Plot / Destination")}</th>
                  <th className="py-4 px-6">{tr("Notes")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {movements
                  .filter(m => !isWorker || m.movement_type !== 'sell')
                  .map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6 text-gray-500 font-medium">{m.movement_date}</td>
                      <td className="py-4 px-6 font-bold text-gray-900">{m.batch_code}</td>
                      <td className="py-4 px-6">
                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs uppercase">
                          {trEnum(m.movement_type)}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-extrabold text-gray-900">{m.quantity.toLocaleString()} {tr("sulur")}</td>
                      <td className="py-4 px-6 text-gray-700 font-medium">{m.destination_or_plot || '-'}</td>
                      <td className="py-4 px-6 text-gray-500">{m.remarks || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: CALCULATOR (Distinct Worker Field Calculator vs Admin Profit DSS)
         ===================================================================== */}
      {activeTab === 'planner' && (
        <div className="space-y-6">
          <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4">
              <div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs uppercase">
                  {isWorker ? tr("Worker Field Preparation Tool (LPNM Standard)") : tr("Management Financial & Resource DSS (LPNM Standard)")}
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-2">
                  {isWorker
                    ? tr("Field Seed & Fertilizer Quantity Calculator")
                    : tr("Smart Planting, Fertilizer & Profit Calculator (DSS)")}
                </h3>
                <p className="text-sm text-gray-500">
                  {isWorker
                    ? tr("Select your Pineapple Variety and Land Area (Hectares) to see how many sulur baskets, NPK bags, and foliar tanks to prepare.")
                    : tr("Select Pineapple Variety and Land Area (Hectares) to auto-calculate required sulur, fertilizer budget, and projected net profit (RM).")}
                </p>
              </div>

              {/* ONLY ADMIN CAN SEE & ADJUST FINANCIAL COSTS (RM) */}
              {!isWorker && (
                <button
                  type="button"
                  onClick={() => setShowAdvancedRates(!showAdvancedRates)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold transition"
                >
                  <SlidersHorizontal size={15} />
                  <span>{showAdvancedRates ? tr("Hide Cost Adjustments") : tr("Adjust Custom Costs (RM)")}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  {tr("Step 1: Select Pineapple Variety")}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['MD2', 'Moris', 'Josapine', 'N36'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleAreaOrVarietyChange(v, calcAreaHa)}
                      className={`py-3 px-4 rounded-xl font-bold text-sm border transition text-left flex justify-between items-center ${
                        calcVariety === v
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span>{v}</span>
                      <span className={`text-xs ${calcVariety === v ? 'text-emerald-100' : 'text-gray-400'}`}>
                        {(LPNM_STANDARDS[v].density / 1000).toFixed(1)}{tr("k/ha")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  {tr("Step 2: Enter Land Area (Hectares)")}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={calcAreaHa}
                    onChange={e => handleAreaOrVarietyChange(calcVariety, Math.max(Number(e.target.value), 0.1))}
                    className="w-36 p-3.5 bg-white border border-gray-300 rounded-xl text-xl font-extrabold text-gray-900"
                  />
                  <span className="text-sm font-bold text-gray-600">{tr("Hectares (ha)")}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[0.5, 1.0, 2.0, 5.0].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAreaOrVarietyChange(calcVariety, preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        calcAreaHa === preset
                          ? 'bg-amber-500 text-gray-950'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {preset} {tr("ha")} {preset === 0.5 && !isWorker ? tr("(Appendix 11.0 Example)") : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!isWorker && showAdvancedRates && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-amber-50/60 border border-amber-200 rounded-2xl">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Sulur Seed Cost (RM)")}</label>
                  <input
                    type="number"
                    value={customSulurCost}
                    onChange={e => setCustomSulurCost(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Nutrient Cost (RM)")}</label>
                  <input
                    type="number"
                    value={customNutrientCost}
                    onChange={e => setCustomNutrientCost(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Operational Cost (RM)")}</label>
                  <input
                    type="number"
                    value={customOpCost}
                    onChange={e => setCustomOpCost(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Expected Revenue (RM)")}</label>
                  <input
                    type="number"
                    value={customRevenue}
                    onChange={e => setCustomRevenue(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* =================================================================
              ROLE-DISTINCT RESULT CARDS (WORKER FIELD UNITS vs ADMIN PROFIT RM)
             ================================================================= */}
          {isWorker ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-xs font-bold uppercase text-gray-400">{tr("1. Sulur Seed to Prepare")}</span>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">
                  {requiredSulur.toLocaleString()} <span className="text-sm font-semibold text-gray-500">{tr("sulur")}</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {tr("Field Load:")} <strong>~{Math.ceil(requiredSulur / 500)} {tr("Baskets (Raga)")}</strong> {tr("@ 500 sulur/raga")}
                </p>
                <div className={`mt-4 p-3 rounded-xl text-xs font-bold ${
                  shortfall > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
                }`}>
                  {shortfall > 0
                    ? tr("Nursery Shortfall: Need {0} more {1} sulur", shortfall.toLocaleString(), calcVariety)
                    : tr("Stock Ready in Nursery ({0} available)", availForVariety.toLocaleString())}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-xs font-bold uppercase text-gray-400">{tr("2. Granular NPK Fertilizer")}</span>
                <p className="text-3xl font-extrabold text-blue-700 mt-1">
                  {npkNeededKg.toLocaleString()} <span className="text-sm font-semibold text-gray-500">{tr("kg NPK")}</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {tr("LPNM Rate:")} {std.npkPer1000} {tr("kg per 1,000 sulur planted")}
                </p>
                <div className="mt-4 p-3 rounded-xl bg-blue-50 text-blue-800 text-xs font-bold">
                  {tr("Store Issue: Prepare ~")}{Math.ceil(npkNeededKg / 50)} {tr("Bags (Guni 50kg)")}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-xs font-bold uppercase text-gray-400">{tr("3. Foliar Liquid Spray")}</span>
                <p className="text-3xl font-extrabold text-teal-700 mt-1">
                  {foliarNeededL.toLocaleString()} <span className="text-sm font-semibold text-gray-500">{tr("Liters")}</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {tr("LPNM Rate:")} {std.foliarPer1000} {tr("L per 1,000 sulur planted")}
                </p>
                <div className="mt-4 p-3 rounded-xl bg-teal-50 text-teal-800 text-xs font-bold flex items-center gap-1.5">
                  <Droplets size={14} />
                  <span>{tr("Knapsack Mix: ~")}{Math.ceil(foliarNeededL / 20)} {tr("Spray Tanks (20L)")}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-xs font-bold uppercase text-gray-400">{tr("1. Sulur Seed Needed")}</span>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">
                  {requiredSulur.toLocaleString()} <span className="text-sm font-semibold text-gray-500">{tr("sulur")}</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {tr("Formula:")} {calcAreaHa} {tr("ha x")} {std.density.toLocaleString()} {tr("trees/ha")}
                </p>
                <div className={`mt-4 p-3 rounded-xl text-xs font-bold ${
                  shortfall > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
                }`}>
                  {shortfall > 0
                    ? tr("Shortfall: Need {0} more {1} sulur (Available: {2})", shortfall.toLocaleString(), calcVariety, availForVariety.toLocaleString())
                    : tr("Stock Sufficient! ({0} {1} sulur in nursery)", availForVariety.toLocaleString(), calcVariety)}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-xs font-bold uppercase text-gray-400">{tr("2. MPIB Fertilizer Needed")}</span>
                <p className="text-3xl font-extrabold text-blue-700 mt-1">
                  {npkNeededKg.toLocaleString()} <span className="text-sm font-semibold text-gray-500">{tr("kg NPK")}</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  + <strong>{foliarNeededL} {tr("Liters")}</strong> {tr("Foliar Fertilizer")}
                </p>
                <div className="mt-4 p-3 rounded-xl bg-blue-50 text-blue-800 text-xs font-bold">
                  {tr("Estimated Nutrient Budget: RM")} {customNutrientCost.toLocaleString()}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-xs font-bold uppercase text-gray-400">{tr("3. Projected Net Profit (Admin Only)")}</span>
                <p className={`text-3xl font-extrabold mt-1 ${projectedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {tr("RM")} {projectedProfit.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {tr("Revenue: RM")} {customRevenue.toLocaleString()} {tr("| Total Cost: RM")} {totalCost.toLocaleString()}
                </p>
                <div className="mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold">
                  {tr("Projected Return (ROI):")} {roiPct}%
                </div>
              </div>
            </div>
          )}

          {/* Smart Recommendations Box */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500">
              {isWorker
                ? tr("Field Preparation Instructions (Rule-Based Checklist):")
                : tr("Smart Decision Support Recommendations (IF-THEN Rules):")}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-xl border text-sm ${
                shortfall > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className="font-bold flex items-center gap-2">
                  {shortfall > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                  <span>{shortfall > 0 ? tr("INSUFFICIENT SULUR STOCK ALERT") : tr("STOCK AVAILABILITY VERIFIED")}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed">
                  {shortfall > 0
                    ? tr("Your nursery currently has {0} {1} sulur, which is {2} less than the {3} required for {4} ha.", availForVariety.toLocaleString(), calcVariety, shortfall.toLocaleString(), requiredSulur.toLocaleString(), calcAreaHa)
                    : tr("Your nursery has enough {0} sulur ({1} available) to cover this {2} ha planting plan.", calcVariety, availForVariety.toLocaleString(), calcAreaHa)}
                </p>
              </div>

              {isWorker ? (
                <div className="p-4 rounded-xl border bg-blue-50 border-blue-200 text-blue-950 text-sm">
                  <div className="font-bold flex items-center gap-2">
                    <ClipboardCheck size={16} />
                    <span>{tr("FIELD OPERATOR CHECKLIST (LPNM GUIDELINE)")}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed">
                    {tr("Ensure all")} {requiredSulur.toLocaleString()} {calcVariety} {tr("sulur are sorted by uniform size grade (Grade A/B separated) and fungicide-dipped before transporting to the plot.")}
                  </p>
                </div>
              ) : (
                <div className={`p-4 rounded-xl border text-sm ${
                  projectedProfit < 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="font-bold flex items-center gap-2">
                    {projectedProfit < 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                    <span>{projectedProfit < 0 ? tr("PROJECTED LOSS WARNING") : tr("PROFITABLE CULTIVATION PLAN")}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed">
                    {projectedProfit < 0
                      ? tr("Total cost (RM {0}) exceeds expected revenue (RM {1}). Review seed or fertilizer costs.", totalCost.toLocaleString(), customRevenue.toLocaleString())
                      : tr("Expected net profit is RM {0} ({1}% ROI). Recommended for Farm Manager approval.", projectedProfit.toLocaleString(), roiPct)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL 1: "+ ADD NEW SULUR BATCH" */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 animate-fade-in">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {isWorker ? tr("Log Newly Harvested Sulur Batch") : tr("Add New Sulur Batch")}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Pineapple Variety")}</label>
                  <select
                    value={newBatch.variety}
                    onChange={e => setNewBatch({ ...newBatch, variety: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
                  >
                    <option value="MD2">MD2</option>
                    <option value="Moris">Moris</option>
                    <option value="Josapine">Josapine</option>
                    <option value="N36">N36</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Size Grade (LPNM)")}</label>
                  <select
                    value={newBatch.size_grade}
                    onChange={e => setNewBatch({ ...newBatch, size_grade: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
                  >
                    <option value="Grade A">{tr("Grade A (35-45cm)")}</option>
                    <option value="Grade B">{tr("Grade B (25-34cm)")}</option>
                    <option value="Grade C">{tr("Grade C (<25cm)")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Quantity (Pieces)")}</label>
                  <input
                    type="number"
                    value={newBatch.initial_quantity}
                    onChange={e => setNewBatch({ ...newBatch, initial_quantity: Number(e.target.value) })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Status")}</label>
                  <select
                    value={newBatch.treatment_status}
                    onChange={e => setNewBatch({ ...newBatch, treatment_status: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
                  >
                    <option value="ready_to_plant">{tr("Ready to Plant")}</option>
                    <option value="fungicide_treated">{tr("Fungicide Treated")}</option>
                    <option value="curing">{tr("Curing / Drying")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Source Plot")}</label>
                  <input
                    type="text"
                    value={newBatch.source_plot}
                    onChange={e => setNewBatch({ ...newBatch, source_plot: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Nursery Shed")}</label>
                  <input
                    type="text"
                    value={newBatch.storage_location}
                    onChange={e => setNewBatch({ ...newBatch, storage_location: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
                    required
                  />
                </div>
              </div>

              {!isWorker && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBatch.is_certified}
                    onChange={e => setNewBatch({ ...newBatch, is_certified: e.target.checked })}
                  />
                  <span>{tr("Issue LPNM Management Quality Certificate")}</span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600"
                >
                  {tr("Cancel")}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                >
                  {tr("Save Batch")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL 2: "PLANT / MOVE STOCK" */}
      {moveModalBatch && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {isWorker ? tr("Take Sulur & Plant to Field") : tr("Plant / Move Sulur Stock")}
                </h3>
                <p className="text-xs text-gray-500">
                  {moveModalBatch.batch_code} ({moveModalBatch.variety} {tr("- Available:")} {moveModalBatch.available_quantity.toLocaleString()})
                </p>
              </div>
              <button onClick={() => setMoveModalBatch(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleQuickMove} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Action")}</label>
                <select
                  value={moveForm.movement_type}
                  onChange={e => setMoveForm({ ...moveForm, movement_type: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
                >
                  <option value="plant">{tr("Plant to Field (Stock-Out)")}</option>
                  <option value="reserve">{tr("Reserve for Upcoming Plot")}</option>
                  {!isWorker && <option value="sell">{tr("Sell to Cooperative / Buyer")}</option>}
                  <option value="damage">{tr("Record Spoiled / Damaged")}</option>
                  <option value="stock_in">{tr("Add More Stock-In")}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Quantity (Sulur Pieces)")}</label>
                <input
                  type="number"
                  value={moveForm.quantity}
                  onChange={e => setMoveForm({ ...moveForm, quantity: Number(e.target.value) })}
                  className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">{tr("Target Plot / Destination")}</label>
                <input
                  type="text"
                  value={moveForm.destination_or_plot}
                  onChange={e => setMoveForm({ ...moveForm, destination_or_plot: e.target.value })}
                  className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMoveModalBatch(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600"
                >
                  {tr("Cancel")}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                >
                  {tr("Confirm & Update Stock")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const SulurManagement: React.FC = () => {
  const location = useLocation();
  const user = authService?.getUser?.();
  const isWorker = user?.role === 'worker' || location.pathname.startsWith('/worker');

  if (isWorker) {
    return (
      <WorkerLayout>
        <div className="p-6">
          <SulurManagementContent isWorker={true} />
        </div>
      </WorkerLayout>
    );
  }
  return (
    <AdminLayout
      title={tr("Sulur Inventory & Tracking (Management Portal)")}
      subtitle={tr("LPNM Seed Quality Certification, Batch Traceability & Financial Profit DSS")}
    >
      <SulurManagementContent isWorker={false} />
    </AdminLayout>
  );
};

export default SulurManagement;
