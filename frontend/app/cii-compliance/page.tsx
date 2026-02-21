'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Card from '@/components/Card';
import {
  Leaf,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Target,
  Fuel,
  Ship,
  Gauge,
  Users,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import {
  apiClient,
  CIICalculationResponse,
  CIIProjectionResponse,
  CIIReductionResponse,
  CIISpeedSweepResponse,
  CIISpeedSweepPoint,
  CIIThresholdsResponse,
  CIIFleetResponse,
  CIIFleetVessel,
  VesselTypeInfo,
  FuelTypeInfo,
} from '@/lib/api';

type TabType = 'calculator' | 'projection' | 'reduction' | 'simulator' | 'fleet';

export default function CIICompliancePage() {
  const [activeTab, setActiveTab] = useState<TabType>('calculator');
  const [vesselTypes, setVesselTypes] = useState<VesselTypeInfo[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculator state
  const [calcResult, setCalcResult] = useState<CIICalculationResponse | null>(null);
  const [calcForm, setCalcForm] = useState({
    vlsfo: 5000,
    mgo: 500,
    distance: 50000,
    dwt: 49000,
    vesselType: 'tanker',
    year: 2024,
  });

  // Projection state
  const [projResult, setProjResult] = useState<CIIProjectionResponse | null>(null);
  const [projForm, setProjForm] = useState({
    annualFuel: 7000,
    annualDistance: 60000,
    dwt: 49000,
    vesselType: 'tanker',
    startYear: 2024,
    endYear: 2030,
    efficiencyImprovement: 0,
  });
  const [thresholds, setThresholds] = useState<CIIThresholdsResponse | null>(null);

  // Reduction state
  const [reductionResult, setReductionResult] = useState<CIIReductionResponse | null>(null);
  const [reductionForm, setReductionForm] = useState({
    currentFuel: 7000,
    currentDistance: 60000,
    dwt: 49000,
    vesselType: 'tanker',
    targetRating: 'C',
    targetYear: 2026,
  });

  // Simulator state
  const [sweepResult, setSweepResult] = useState<CIISpeedSweepResponse | null>(null);
  const [simForm, setSimForm] = useState({
    dwt: 49000,
    vesselType: 'tanker',
    distance: 4000,
    voyagesPerYear: 12,
    fuelType: 'vlsfo',
    year: 2026,
    speedMin: 8,
    speedMax: 16,
    speedStep: 0.5,
    isLaden: true,
  });

  // Fleet state
  const [fleetResult, setFleetResult] = useState<CIIFleetResponse | null>(null);
  const [fleetVessels, setFleetVessels] = useState<CIIFleetVessel[]>([
    { name: 'Vessel A', dwt: 49000, vessel_type: 'tanker', fuel_consumption_mt: { vlsfo: 5000 }, total_distance_nm: 50000, year: 2026 },
    { name: 'Vessel B', dwt: 75000, vessel_type: 'bulk_carrier', fuel_consumption_mt: { vlsfo: 7000 }, total_distance_nm: 60000, year: 2026 },
  ]);

  useEffect(() => {
    loadReferenceData();
  }, []);

  const loadReferenceData = async () => {
    try {
      const [vesselData, fuelData] = await Promise.all([
        apiClient.getVesselTypes(),
        apiClient.getFuelTypes(),
      ]);
      setVesselTypes(vesselData.vessel_types);
      setFuelTypes(fuelData.fuel_types);
    } catch (error) {
      console.error('Failed to load reference data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCII = async () => {
    try {
      const result = await apiClient.calculateCII({
        fuel_consumption_mt: {
          vlsfo: calcForm.vlsfo,
          mgo: calcForm.mgo,
        },
        total_distance_nm: calcForm.distance,
        dwt: calcForm.dwt,
        vessel_type: calcForm.vesselType,
        year: calcForm.year,
      });
      setCalcResult(result);
    } catch (error) {
      console.error('CII calculation failed:', error);
    }
  };

  const projectCII = async () => {
    try {
      const [result, thresholdData] = await Promise.all([
        apiClient.projectCII({
          annual_fuel_mt: { vlsfo: projForm.annualFuel },
          annual_distance_nm: projForm.annualDistance,
          dwt: projForm.dwt,
          vessel_type: projForm.vesselType,
          start_year: projForm.startYear,
          end_year: projForm.endYear,
          fuel_efficiency_improvement_pct: projForm.efficiencyImprovement,
        }),
        apiClient.getCIIThresholds({
          dwt: projForm.dwt,
          vessel_type: projForm.vesselType,
        }),
      ]);
      setProjResult(result);
      setThresholds(thresholdData);
    } catch (error) {
      console.error('CII projection failed:', error);
    }
  };

  const calculateReduction = async () => {
    try {
      const result = await apiClient.calculateCIIReduction({
        current_fuel_mt: { vlsfo: reductionForm.currentFuel },
        current_distance_nm: reductionForm.currentDistance,
        dwt: reductionForm.dwt,
        vessel_type: reductionForm.vesselType,
        target_rating: reductionForm.targetRating,
        target_year: reductionForm.targetYear,
      });
      setReductionResult(result);
    } catch (error) {
      console.error('CII reduction calculation failed:', error);
    }
  };

  const runSpeedSweep = async () => {
    try {
      const result = await apiClient.simulateCIISpeed({
        dwt: simForm.dwt,
        vessel_type: simForm.vesselType,
        distance_nm: simForm.distance,
        voyages_per_year: simForm.voyagesPerYear,
        fuel_type: simForm.fuelType,
        year: simForm.year,
        speed_min_kts: simForm.speedMin,
        speed_max_kts: simForm.speedMax,
        speed_step_kts: simForm.speedStep,
        is_laden: simForm.isLaden,
      });
      setSweepResult(result);
    } catch (error) {
      console.error('Speed sweep failed:', error);
    }
  };

  const calculateFleet = async () => {
    try {
      const result = await apiClient.calculateFleetCII({ vessels: fleetVessels });
      setFleetResult(result);
    } catch (error) {
      console.error('Fleet CII calculation failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-maritime">
      <Header />

      <main className="container mx-auto px-6 pt-20 pb-12">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-3">
            <Leaf className="w-10 h-10 text-green-400" />
            <h2 className="text-4xl font-bold text-white">CII Compliance</h2>
          </div>
          <p className="text-gray-300 text-lg">
            Carbon Intensity Indicator calculator and projections for IMO 2023 regulations
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <TabButton
            active={activeTab === 'calculator'}
            onClick={() => setActiveTab('calculator')}
            icon={<Target className="w-4 h-4" />}
          >
            Rating Calculator
          </TabButton>
          <TabButton
            active={activeTab === 'projection'}
            onClick={() => setActiveTab('projection')}
            icon={<Calendar className="w-4 h-4" />}
          >
            Future Projection
          </TabButton>
          <TabButton
            active={activeTab === 'reduction'}
            onClick={() => setActiveTab('reduction')}
            icon={<TrendingDown className="w-4 h-4" />}
          >
            Reduction Planner
          </TabButton>
          <TabButton
            active={activeTab === 'simulator'}
            onClick={() => setActiveTab('simulator')}
            icon={<Gauge className="w-4 h-4" />}
          >
            Speed Simulator
          </TabButton>
          <TabButton
            active={activeTab === 'fleet'}
            onClick={() => setActiveTab('fleet')}
            icon={<Users className="w-4 h-4" />}
          >
            Fleet Comparison
          </TabButton>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {activeTab === 'calculator' && (
              <CalculatorTab
                form={calcForm}
                setForm={setCalcForm}
                result={calcResult}
                onCalculate={calculateCII}
                vesselTypes={vesselTypes}
              />
            )}
            {activeTab === 'projection' && (
              <ProjectionTab
                form={projForm}
                setForm={setProjForm}
                result={projResult}
                thresholds={thresholds}
                onProject={projectCII}
                vesselTypes={vesselTypes}
              />
            )}
            {activeTab === 'reduction' && (
              <ReductionTab
                form={reductionForm}
                setForm={setReductionForm}
                result={reductionResult}
                onCalculate={calculateReduction}
                vesselTypes={vesselTypes}
              />
            )}
            {activeTab === 'simulator' && (
              <SimulatorTab
                form={simForm}
                setForm={setSimForm}
                result={sweepResult}
                onRun={runSpeedSweep}
                vesselTypes={vesselTypes}
                fuelTypes={fuelTypes}
              />
            )}
            {activeTab === 'fleet' && (
              <FleetTab
                vessels={fleetVessels}
                setVessels={setFleetVessels}
                result={fleetResult}
                onCalculate={calculateFleet}
                vesselTypes={vesselTypes}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
        active
          ? 'bg-primary-500 text-white'
          : 'bg-white/5 text-gray-300 hover:bg-white/10'
      }`}
    >
      {icon}
      <span className="font-medium">{children}</span>
    </button>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400" />
    </div>
  );
}

function CalculatorTab({
  form,
  setForm,
  result,
  onCalculate,
  vesselTypes,
}: {
  form: any;
  setForm: (f: any) => void;
  result: CIICalculationResponse | null;
  onCalculate: () => void;
  vesselTypes: VesselTypeInfo[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <Card title="Input Parameters" icon={<Fuel className="w-5 h-5" />}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">VLSFO (MT)</label>
              <input
                type="number"
                value={form.vlsfo}
                onChange={(e) => setForm({ ...form, vlsfo: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">MGO (MT)</label>
              <input
                type="number"
                value={form.mgo}
                onChange={(e) => setForm({ ...form, mgo: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Total Distance (nm)</label>
            <input
              type="number"
              value={form.distance}
              onChange={(e) => setForm({ ...form, distance: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">DWT</label>
              <input
                type="number"
                value={form.dwt}
                onChange={(e) => setForm({ ...form, dwt: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Year</label>
              <select
                value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
              >
                {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Vessel Type</label>
            <select
              value={form.vesselType}
              onChange={(e) => setForm({ ...form, vesselType: e.target.value })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            >
              {vesselTypes.map((vt) => (
                <option key={vt.id} value={vt.id}>{vt.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={onCalculate}
            className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors"
          >
            Calculate CII Rating
          </button>
        </div>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          <RatingCard result={result} />
          <CIIDetailsCard result={result} />
        </div>
      )}
    </div>
  );
}

function RatingCard({ result }: { result: CIICalculationResponse }) {
  const ratingColors: Record<string, string> = {
    A: 'from-green-500 to-green-600',
    B: 'from-lime-500 to-lime-600',
    C: 'from-yellow-500 to-yellow-600',
    D: 'from-orange-500 to-orange-600',
    E: 'from-red-500 to-red-600',
  };

  const ratingIcons: Record<string, React.ReactNode> = {
    A: <CheckCircle className="w-8 h-8" />,
    B: <CheckCircle className="w-8 h-8" />,
    C: <AlertTriangle className="w-8 h-8" />,
    D: <XCircle className="w-8 h-8" />,
    E: <XCircle className="w-8 h-8" />,
  };

  return (
    <Card>
      <div className="text-center">
        <p className="text-sm text-gray-400 mb-2">CII Rating {result.year}</p>
        <div
          className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br ${
            ratingColors[result.rating]
          } mb-4`}
        >
          <span className="text-5xl font-bold text-white">{result.rating}</span>
        </div>
        <div className="flex items-center justify-center space-x-2 mb-4">
          {ratingIcons[result.rating]}
          <span className="text-lg font-medium text-white">{result.compliance_status}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="p-3 bg-maritime-dark rounded-lg">
            <p className="text-xs text-gray-400">Attained CII</p>
            <p className="text-xl font-bold text-white">{result.attained_cii.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-maritime-dark rounded-lg">
            <p className="text-xs text-gray-400">Required CII</p>
            <p className="text-xl font-bold text-white">{result.required_cii.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CIIDetailsCard({ result }: { result: CIICalculationResponse }) {
  return (
    <Card title="Details" icon={<Ship className="w-5 h-5" />}>
      <div className="space-y-3">
        <DetailRow label="Total CO2 Emissions" value={`${result.total_co2_mt.toLocaleString()} MT`} />
        <DetailRow label="Total Distance" value={`${result.total_distance_nm.toLocaleString()} nm`} />
        <DetailRow label="Capacity (DWT)" value={result.capacity.toLocaleString()} />
        <DetailRow label="Reduction Factor" value={`${result.reduction_factor}%`} />
        <div className="pt-3 border-t border-white/10">
          <p className="text-xs text-gray-400 mb-2">Rating Boundaries</p>
          <div className="grid grid-cols-5 gap-1">
            {['A', 'B', 'C', 'D', 'E'].map((r) => (
              <div
                key={r}
                className={`text-center py-1 rounded ${
                  result.rating === r ? 'bg-primary-500' : 'bg-white/5'
                }`}
              >
                <span className="text-xs font-semibold text-white">{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

function ProjectionTab({
  form,
  setForm,
  result,
  thresholds,
  onProject,
  vesselTypes,
}: {
  form: any;
  setForm: (f: any) => void;
  result: CIIProjectionResponse | null;
  thresholds: CIIThresholdsResponse | null;
  onProject: () => void;
  vesselTypes: VesselTypeInfo[];
}) {
  // Build chart data merging projections + thresholds
  const chartData = (() => {
    if (!thresholds || !result) return [];
    const projMap = new Map(result.projections.map(p => [p.year, p]));
    return thresholds.years
      .filter(t => t.year >= form.startYear && t.year <= Math.max(form.endYear, 2035))
      .map(t => {
        const proj = projMap.get(t.year);
        return {
          year: t.year,
          A_upper: t.boundaries.A_upper,
          B_upper: t.boundaries.B_upper,
          C_upper: t.boundaries.C_upper,
          D_upper: t.boundaries.D_upper,
          required: t.required_cii,
          attained: proj?.attained_cii ?? null,
        };
      });
  })();

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card title="Projection Parameters" icon={<Calendar className="w-5 h-5" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Annual Fuel (MT)</label>
            <input
              type="number"
              value={form.annualFuel}
              onChange={(e) => setForm({ ...form, annualFuel: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Annual Distance (nm)</label>
            <input
              type="number"
              value={form.annualDistance}
              onChange={(e) => setForm({ ...form, annualDistance: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">DWT</label>
            <input
              type="number"
              value={form.dwt}
              onChange={(e) => setForm({ ...form, dwt: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Vessel Type</label>
            <select
              value={form.vesselType}
              onChange={(e) => setForm({ ...form, vesselType: e.target.value })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            >
              {vesselTypes.map((vt) => (
                <option key={vt.id} value={vt.id}>{vt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Efficiency Gain (%/yr)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="10"
              value={form.efficiencyImprovement}
              onChange={(e) => setForm({ ...form, efficiencyImprovement: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={onProject}
              className="w-full py-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors"
            >
              Project
            </button>
          </div>
        </div>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <Card title="Projection Summary" icon={<AlertTriangle className="w-5 h-5" />}>
            <div className="p-4 bg-maritime-dark rounded-lg">
              <p className="text-lg text-white">{result.summary.recommendation}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <p className="text-xs text-gray-400">Current Rating</p>
                  <p className="text-2xl font-bold text-white">{result.summary.current_rating}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Final Rating ({form.endYear})</p>
                  <p className="text-2xl font-bold text-white">{result.summary.final_rating}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Years to D Rating</p>
                  <p className="text-2xl font-bold text-orange-400">{result.summary.years_until_d_rating}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Years to E Rating</p>
                  <p className="text-2xl font-bold text-red-400">{result.summary.years_until_e_rating}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Threshold Chart */}
          {chartData.length > 0 && (
            <Card title="CII Rating Boundaries Over Time">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                      itemStyle={{ color: '#9ca3af' }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          A_upper: 'A/B Boundary',
                          B_upper: 'B/C Boundary',
                          C_upper: 'C/D Boundary',
                          D_upper: 'D/E Boundary',
                          attained: 'Attained CII',
                        };
                        return [value?.toFixed(3) ?? '-', labels[name] ?? name];
                      }}
                    />
                    <Area type="monotone" dataKey="A_upper" stackId="x" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" name="A_upper" />
                    <Area type="monotone" dataKey="B_upper" stackId="y" fill="rgba(132,204,22,0.15)" stroke="rgba(132,204,22,0.4)" name="B_upper" />
                    <Area type="monotone" dataKey="C_upper" stackId="z" fill="rgba(234,179,8,0.15)" stroke="rgba(234,179,8,0.4)" name="C_upper" />
                    <Area type="monotone" dataKey="D_upper" stackId="w" fill="rgba(249,115,22,0.15)" stroke="rgba(249,115,22,0.4)" name="D_upper" />
                    <Line type="monotone" dataKey="attained" stroke="#60a5fa" strokeWidth={3} dot={{ r: 4, fill: '#60a5fa' }} name="attained" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-4 mt-3 px-2">
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded bg-green-500/30" /> A</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded bg-lime-500/30" /> B</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded bg-yellow-500/30" /> C</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded bg-orange-500/30" /> D</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded-full bg-blue-400" /> Attained CII</span>
              </div>
            </Card>
          )}

          {/* Timeline */}
          <Card title="Year-by-Year Projection">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Year</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Rating</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Attained CII</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Required CII</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Reduction %</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.projections.map((p) => (
                    <tr key={p.year} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 text-white font-medium">{p.year}</td>
                      <td className="py-3 px-4">
                        <RatingBadge rating={p.rating} />
                      </td>
                      <td className="py-3 px-4 text-white">{p.attained_cii.toFixed(2)}</td>
                      <td className="py-3 px-4 text-gray-300">{p.required_cii.toFixed(2)}</td>
                      <td className="py-3 px-4 text-gray-300">{p.reduction_factor}%</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function RatingBadge({ rating }: { rating: string }) {
  const colors: Record<string, string> = {
    A: 'bg-green-500/20 text-green-400',
    B: 'bg-lime-500/20 text-lime-400',
    C: 'bg-yellow-500/20 text-yellow-400',
    D: 'bg-orange-500/20 text-orange-400',
    E: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-bold ${colors[rating]}`}>
      {rating}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    compliant: 'bg-green-500/20 text-green-400',
    at_risk: 'bg-yellow-500/20 text-yellow-400',
    non_compliant: 'bg-red-500/20 text-red-400',
  };
  const labels: Record<string, string> = {
    compliant: 'Compliant',
    at_risk: 'At Risk',
    non_compliant: 'Non-Compliant',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

function ReductionTab({
  form,
  setForm,
  result,
  onCalculate,
  vesselTypes,
}: {
  form: any;
  setForm: (f: any) => void;
  result: CIIReductionResponse | null;
  onCalculate: () => void;
  vesselTypes: VesselTypeInfo[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <Card title="Reduction Calculator" icon={<Target className="w-5 h-5" />}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Current Annual Fuel (MT)</label>
              <input
                type="number"
                value={form.currentFuel}
                onChange={(e) => setForm({ ...form, currentFuel: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Annual Distance (nm)</label>
              <input
                type="number"
                value={form.currentDistance}
                onChange={(e) => setForm({ ...form, currentDistance: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">DWT</label>
              <input
                type="number"
                value={form.dwt}
                onChange={(e) => setForm({ ...form, dwt: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vessel Type</label>
              <select
                value={form.vesselType}
                onChange={(e) => setForm({ ...form, vesselType: e.target.value })}
                className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
              >
                {vesselTypes.map((vt) => (
                  <option key={vt.id} value={vt.id}>{vt.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Target Rating</label>
              <select
                value={form.targetRating}
                onChange={(e) => setForm({ ...form, targetRating: e.target.value })}
                className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
              >
                <option value="A">A - Superior</option>
                <option value="B">B - Good</option>
                <option value="C">C - Compliant</option>
                <option value="D">D - Needs Improvement</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Target Year</label>
              <select
                value={form.targetYear}
                onChange={(e) => setForm({ ...form, targetYear: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={onCalculate}
            className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors"
          >
            Calculate Required Reduction
          </button>
        </div>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          <Card>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">Required Fuel Reduction</p>
              <p className="text-5xl font-bold text-primary-400 mb-2">
                {result.reduction_needed_pct.toFixed(1)}%
              </p>
              <p className="text-gray-300">{result.message}</p>
            </div>
          </Card>

          <Card title="Analysis" icon={<TrendingDown className="w-5 h-5" />}>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-maritime-dark rounded-lg">
                <span className="text-gray-400">Current Rating</span>
                <RatingBadge rating={result.current_rating} />
              </div>
              <div className="flex justify-between items-center p-3 bg-maritime-dark rounded-lg">
                <span className="text-gray-400">Target Rating</span>
                <RatingBadge rating={result.target_rating} />
              </div>
              <div className="flex justify-between items-center p-3 bg-maritime-dark rounded-lg">
                <span className="text-gray-400">Current CII</span>
                <span className="text-white font-medium">{result.current_cii.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-maritime-dark rounded-lg">
                <span className="text-gray-400">Target CII</span>
                <span className="text-white font-medium">{result.target_cii.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <span className="text-green-400">Potential Fuel Savings</span>
                <span className="text-green-400 font-bold">{result.fuel_savings_mt.toLocaleString()} MT/year</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Simulator Tab (Phase 2b)
// ============================================================================

function SimulatorTab({
  form,
  setForm,
  result,
  onRun,
  vesselTypes,
  fuelTypes,
}: {
  form: any;
  setForm: (f: any) => void;
  result: CIISpeedSweepResponse | null;
  onRun: () => void;
  vesselTypes: VesselTypeInfo[];
  fuelTypes: FuelTypeInfo[];
}) {
  // Build chart data with rating color bands
  const chartData = result?.points.map((p) => ({
    speed: p.speed_kts,
    cii: p.attained_cii,
    required: p.required_cii,
    fuel: p.annual_fuel_mt,
    rating: p.rating,
  })) ?? [];

  const ratingColorMap: Record<string, string> = {
    A: '#22c55e',
    B: '#84cc16',
    C: '#eab308',
    D: '#f97316',
    E: '#ef4444',
  };

  return (
    <div className="space-y-6">
      {/* Input Controls */}
      <Card title="Speed-CII Simulation" icon={<Gauge className="w-5 h-5" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">DWT</label>
            <input
              type="number"
              value={form.dwt}
              onChange={(e) => setForm({ ...form, dwt: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Voyage Distance (nm)</label>
            <input
              type="number"
              value={form.distance}
              onChange={(e) => setForm({ ...form, distance: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Voyages / Year</label>
            <input
              type="number"
              value={form.voyagesPerYear}
              onChange={(e) => setForm({ ...form, voyagesPerYear: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Fuel Type</label>
            <select
              value={form.fuelType}
              onChange={(e) => setForm({ ...form, fuelType: e.target.value })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            >
              {fuelTypes.map((ft) => (
                <option key={ft.id} value={ft.id}>{ft.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Year</label>
            <select
              value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Speed Min (kts)</label>
            <input
              type="number"
              step="0.5"
              value={form.speedMin}
              onChange={(e) => setForm({ ...form, speedMin: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Speed Max (kts)</label>
            <input
              type="number"
              step="0.5"
              value={form.speedMax}
              onChange={(e) => setForm({ ...form, speedMax: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Vessel Type</label>
            <select
              value={form.vesselType}
              onChange={(e) => setForm({ ...form, vesselType: e.target.value })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            >
              {vesselTypes.map((vt) => (
                <option key={vt.id} value={vt.id}>{vt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Loading</label>
            <select
              value={form.isLaden ? 'laden' : 'ballast'}
              onChange={(e) => setForm({ ...form, isLaden: e.target.value === 'laden' })}
              className="w-full px-3 py-2 bg-maritime-dark border border-white/10 rounded-lg text-white"
            >
              <option value="laden">Laden</option>
              <option value="ballast">Ballast</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={onRun}
              className="w-full py-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors"
            >
              Simulate
            </button>
          </div>
        </div>
      </Card>

      {/* Chart */}
      {result && (
        <>
          <Card title="Speed vs. CII Rating">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="speed" stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'Speed (kts)', position: 'insideBottom', offset: -2, style: { fill: '#9ca3af', fontSize: 11 } }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'CII', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 11 } }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = { cii: 'Attained CII', required: 'Required CII', fuel: 'Annual Fuel (MT)' };
                      return [typeof value === 'number' ? value.toFixed(3) : value, labels[name] ?? name];
                    }}
                    labelFormatter={(label) => `${label} kts`}
                  />
                  {/* Rating boundary bands using ReferenceArea */}
                  {result.rating_boundaries.A_upper && (
                    <ReferenceArea y1={0} y2={result.rating_boundaries.A_upper} fill="rgba(34,197,94,0.08)" />
                  )}
                  {result.rating_boundaries.A_upper && result.rating_boundaries.B_upper && (
                    <ReferenceArea y1={result.rating_boundaries.A_upper} y2={result.rating_boundaries.B_upper} fill="rgba(132,204,22,0.08)" />
                  )}
                  {result.rating_boundaries.B_upper && result.rating_boundaries.C_upper && (
                    <ReferenceArea y1={result.rating_boundaries.B_upper} y2={result.rating_boundaries.C_upper} fill="rgba(234,179,8,0.08)" />
                  )}
                  {result.rating_boundaries.C_upper && result.rating_boundaries.D_upper && (
                    <ReferenceArea y1={result.rating_boundaries.C_upper} y2={result.rating_boundaries.D_upper} fill="rgba(249,115,22,0.08)" />
                  )}
                  <ReferenceLine y={result.rating_boundaries.A_upper} stroke="rgba(34,197,94,0.5)" strokeDasharray="4 4" />
                  <ReferenceLine y={result.rating_boundaries.B_upper} stroke="rgba(132,204,22,0.5)" strokeDasharray="4 4" />
                  <ReferenceLine y={result.rating_boundaries.C_upper} stroke="rgba(234,179,8,0.5)" strokeDasharray="4 4" />
                  <ReferenceLine y={result.rating_boundaries.D_upper} stroke="rgba(249,115,22,0.5)" strokeDasharray="4 4" />
                  <ReferenceLine x={result.optimal_speed_kts} stroke="#60a5fa" strokeDasharray="8 4" label={{ value: 'Optimal', position: 'top', fill: '#60a5fa', fontSize: 11 }} />
                  <Line type="monotone" dataKey="cii" stroke="#f472b6" strokeWidth={2.5} dot={false} name="cii" />
                  <Line type="monotone" dataKey="required" stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="6 3" dot={false} name="required" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 px-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-0.5 bg-pink-400 inline-block" /> Attained CII</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-0.5 bg-white/30 inline-block" style={{ borderTop: '1px dashed' }} /> Required CII</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded bg-green-500/20" /> A</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded bg-lime-500/20" /> B</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded bg-yellow-500/20" /> C</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded bg-orange-500/20" /> D</span>
            </div>
          </Card>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Optimal Speed</p>
                <p className="text-3xl font-bold text-primary-400">{result.optimal_speed_kts} kts</p>
                <p className="text-xs text-gray-500 mt-1">Best achievable rating at lowest speed</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Best Rating</p>
                <p className="text-3xl font-bold">
                  <RatingBadge rating={result.points[0]?.rating ?? '?'} />
                </p>
                <p className="text-xs text-gray-500 mt-1">At {result.points[0]?.speed_kts} kts</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Worst Rating</p>
                <p className="text-3xl font-bold">
                  <RatingBadge rating={result.points[result.points.length - 1]?.rating ?? '?'} />
                </p>
                <p className="text-xs text-gray-500 mt-1">At {result.points[result.points.length - 1]?.speed_kts} kts</p>
              </div>
            </Card>
          </div>

          {/* Data table */}
          <Card title="Speed Sweep Data">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="sticky top-0 bg-maritime-navy">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Speed</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Rating</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">CII</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Fuel/Voyage</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Annual Fuel</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">CO2/yr</th>
                  </tr>
                </thead>
                <tbody>
                  {result.points.map((p) => (
                    <tr key={p.speed_kts} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 px-3 text-white text-sm">{p.speed_kts} kts</td>
                      <td className="py-2 px-3"><RatingBadge rating={p.rating} /></td>
                      <td className="py-2 px-3 text-white text-sm">{p.attained_cii.toFixed(3)}</td>
                      <td className="py-2 px-3 text-gray-300 text-sm">{p.fuel_per_voyage_mt.toFixed(1)} MT</td>
                      <td className="py-2 px-3 text-gray-300 text-sm">{p.annual_fuel_mt.toLocaleString()} MT</td>
                      <td className="py-2 px-3 text-gray-300 text-sm">{p.annual_co2_mt.toLocaleString()} MT</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Fleet Tab (Phase 2b)
// ============================================================================

function FleetTab({
  vessels,
  setVessels,
  result,
  onCalculate,
  vesselTypes,
}: {
  vessels: CIIFleetVessel[];
  setVessels: (v: CIIFleetVessel[]) => void;
  result: CIIFleetResponse | null;
  onCalculate: () => void;
  vesselTypes: VesselTypeInfo[];
}) {
  const addVessel = () => {
    if (vessels.length >= 20) return;
    setVessels([
      ...vessels,
      { name: `Vessel ${String.fromCharCode(65 + vessels.length)}`, dwt: 49000, vessel_type: 'tanker', fuel_consumption_mt: { vlsfo: 5000 }, total_distance_nm: 50000, year: 2026 },
    ]);
  };

  const removeVessel = (idx: number) => {
    setVessels(vessels.filter((_, i) => i !== idx));
  };

  const updateVessel = (idx: number, field: string, value: any) => {
    const updated = [...vessels];
    if (field === 'vlsfo') {
      updated[idx] = { ...updated[idx], fuel_consumption_mt: { vlsfo: Number(value) } };
    } else {
      (updated[idx] as any)[field] = value;
    }
    setVessels(updated);
  };

  const ratingDistribution = result ? ['A', 'B', 'C', 'D', 'E'].map(r => ({
    rating: r,
    count: result.summary[r] ?? 0,
  })) : [];

  const totalVessels = result ? result.results.length : 0;

  const ratingBarColors: Record<string, string> = {
    A: 'bg-green-500',
    B: 'bg-lime-500',
    C: 'bg-yellow-500',
    D: 'bg-orange-500',
    E: 'bg-red-500',
  };

  return (
    <div className="space-y-6">
      {/* Vessel Input Table */}
      <Card title="Fleet Vessels" icon={<Users className="w-5 h-5" />}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Name</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">DWT</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Type</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">VLSFO (MT)</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Distance (nm)</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Year</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {vessels.map((v, idx) => (
                <tr key={idx} className="border-b border-white/5">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => updateVessel(idx, 'name', e.target.value)}
                      className="w-full px-2 py-1 bg-maritime-dark border border-white/10 rounded text-white text-sm"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={v.dwt}
                      onChange={(e) => updateVessel(idx, 'dwt', Number(e.target.value))}
                      className="w-24 px-2 py-1 bg-maritime-dark border border-white/10 rounded text-white text-sm"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={v.vessel_type}
                      onChange={(e) => updateVessel(idx, 'vessel_type', e.target.value)}
                      className="px-2 py-1 bg-maritime-dark border border-white/10 rounded text-white text-sm"
                    >
                      {vesselTypes.map((vt) => (
                        <option key={vt.id} value={vt.id}>{vt.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={v.fuel_consumption_mt.vlsfo ?? 0}
                      onChange={(e) => updateVessel(idx, 'vlsfo', e.target.value)}
                      className="w-24 px-2 py-1 bg-maritime-dark border border-white/10 rounded text-white text-sm"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={v.total_distance_nm}
                      onChange={(e) => updateVessel(idx, 'total_distance_nm', Number(e.target.value))}
                      className="w-24 px-2 py-1 bg-maritime-dark border border-white/10 rounded text-white text-sm"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={v.year}
                      onChange={(e) => updateVessel(idx, 'year', Number(e.target.value))}
                      className="px-2 py-1 bg-maritime-dark border border-white/10 rounded text-white text-sm"
                    >
                      {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => removeVessel(idx)}
                      className="text-red-400 hover:text-red-300"
                      title="Remove vessel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={addVessel}
            disabled={vessels.length >= 20}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> Add Vessel
          </button>
          <button
            onClick={onCalculate}
            disabled={vessels.length === 0}
            className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-40"
          >
            Calculate All
          </button>
        </div>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Distribution Bar */}
          <Card title="Rating Distribution">
            <div className="flex items-center gap-1 h-10 rounded-lg overflow-hidden">
              {ratingDistribution.map(({ rating, count }) =>
                count > 0 ? (
                  <div
                    key={rating}
                    className={`${ratingBarColors[rating]} h-full flex items-center justify-center text-white text-sm font-bold transition-all`}
                    style={{ width: `${(count / totalVessels) * 100}%`, minWidth: count > 0 ? '2rem' : 0 }}
                    title={`${rating}: ${count} vessel(s)`}
                  >
                    {rating} ({count})
                  </div>
                ) : null,
              )}
            </div>
            <div className="flex gap-4 mt-3">
              {ratingDistribution.map(({ rating, count }) => (
                <span key={rating} className="text-xs text-gray-400">
                  {rating}: {count}
                </span>
              ))}
            </div>
          </Card>

          {/* Results Table */}
          <Card title="Fleet CII Results">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Vessel</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Rating</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Attained CII</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Required CII</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">CO2 (MT)</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r) => (
                    <tr key={r.name} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 text-white font-medium">{r.name}</td>
                      <td className="py-3 px-4"><RatingBadge rating={r.rating} /></td>
                      <td className="py-3 px-4 text-white">{r.attained_cii.toFixed(3)}</td>
                      <td className="py-3 px-4 text-gray-300">{r.required_cii.toFixed(3)}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={r.compliance_status === 'Compliant' ? 'compliant' : r.compliance_status === 'At Risk' ? 'at_risk' : 'non_compliant'} />
                      </td>
                      <td className="py-3 px-4 text-gray-300">{r.total_co2_mt.toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-300 text-sm">
                        {r.margin_to_downgrade > 0 ? (
                          <span className="text-green-400">{r.margin_to_downgrade.toFixed(1)}% to downgrade</span>
                        ) : (
                          <span className="text-red-400">{r.margin_to_upgrade.toFixed(1)}% to upgrade</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
