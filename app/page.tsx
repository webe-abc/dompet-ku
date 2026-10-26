'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface Transaction {
  id: number;
  title: string;
  amount: number;
  category: string;
  date: string;
}

interface BudgetPeriod {
  id: string;
  name: string;
  amount: number;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // State Tema (Gelap / Terang)
  const [isDarkMode, setIsDarkMode] = useState(true);

  // State Daftar Modal & Modal Aktif
  const [budgets, setBudgets] = useState<BudgetPeriod[]>([]);
  const [activeBudgetId, setActiveBudgetId] = useState<string>('');
  
  // State Form Edit/Tambah Modal
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [isCreatingNewBudget, setIsCreatingNewBudget] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');

  // Form input transaksi baru
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makanan');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);

  // State Edit Transaksi
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('Makanan');
  const [editDate, setEditDate] = useState('');

  // Filter Riwayat
  const [filterMode, setFilterMode] = useState<'all' | 'month' | 'custom'>('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Inisialisasi tema & tanggal
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setSelectedMonth(today.slice(0, 7));

    const savedTheme = localStorage.getItem('theme_mode');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    localStorage.setItem('theme_mode', nextTheme ? 'dark' : 'light');
  };

  // Tarik semua daftar modal dari Supabase
  const fetchBudgets = async () => {
    const { data, error } = await supabase
      .from('budget_periods')
      .select('*')
      .order('start_date', { ascending: false });

    if (!error && data && data.length > 0) {
      setBudgets(data);
      const active = data.find((b) => b.is_active) || data[0];
      setActiveBudgetId(active.id);
    }
  };

  // Tarik riwayat transaksi
  const fetchTransactions = useCallback(async () => {
    let query = supabase.from('transactions').select('*').order('date', { ascending: false });

    if (filterMode === 'month' && selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      query = query
        .gte('date', `${selectedMonth}-01`)
        .lte('date', `${selectedMonth}-${String(lastDay).padStart(2, '0')}`);
    } else if (filterMode === 'custom') {
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
    }

    const { data, error } = await query;
    if (!error && data) setTransactions(data);
  }, [filterMode, selectedMonth, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
    fetchBudgets();
  }, [fetchTransactions]);

  const currentBudget = budgets.find((b) => b.id === activeBudgetId);

  const handleSwitchBudget = async (id: string) => {
    if (id === 'NEW_BUDGET') {
      const today = new Date().toISOString().split('T')[0];
      setFormName('');
      setFormAmount('');
      setFormStart(today);
      setFormEnd(today);
      setIsCreatingNewBudget(true);
      setIsEditingBudget(true);
      return;
    }

    setActiveBudgetId(id);
    setIsEditingBudget(false);
    setIsCreatingNewBudget(false);

    await supabase.from('budget_periods').update({ is_active: false }).neq('id', id);
    await supabase.from('budget_periods').update({ is_active: true }).eq('id', id);
  };

  const handleOpenEdit = () => {
    if (!currentBudget) return;
    setFormName(currentBudget.name);
    setFormAmount(currentBudget.amount.toString());
    setFormStart(currentBudget.start_date);
    setFormEnd(currentBudget.end_date);
    setIsCreatingNewBudget(false);
    setIsEditingBudget(!isEditingBudget);
  };

  const handleSaveBudgetForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formStart || !formEnd) {
      return alert('Lengkapi nama modal dan rentang tanggalnya.');
    }

    const targetId = isCreatingNewBudget ? `budget_${Date.now()}` : activeBudgetId;
    const newBudgetPayload = {
      id: targetId,
      name: formName.trim(),
      amount: Number(formAmount) || 0,
      start_date: formStart,
      end_date: formEnd,
      is_active: true,
    };

    await supabase.from('budget_periods').update({ is_active: false }).neq('id', targetId);
    const { error } = await supabase.from('budget_periods').upsert(newBudgetPayload);

    if (!error) {
      await fetchBudgets();
      setActiveBudgetId(targetId);
      setIsEditingBudget(false);
      setIsCreatingNewBudget(false);
    }
  };

  const handleDeleteBudget = async () => {
    if (budgets.length <= 1) {
      return alert('Minimal harus ada satu modal tersimpan.');
    }
    if (!confirm(`Hapus modal "${currentBudget?.name}"?`)) return;

    const { error } = await supabase.from('budget_periods').delete().eq('id', activeBudgetId);
    if (!error) {
      setIsEditingBudget(false);
      await fetchBudgets();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !date) return;

    setLoading(true);
    const { error } = await supabase.from('transactions').insert([
      { title, amount: Number(amount), category, date },
    ]);
    setLoading(false);

    if (!error) {
      setTitle('');
      setAmount('');
      setShowAddForm(false);
      fetchTransactions();
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!confirm('Hapus transaksi ini?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) fetchTransactions();
  };

  const startEditingTransaction = (t: Transaction) => {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditAmount(t.amount.toString());
    setEditCategory(t.category);
    setEditDate(t.date);
  };

  const handleUpdateTransaction = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    if (!editTitle || !editAmount) return;

    const { error } = await supabase
      .from('transactions')
      .update({
        title: editTitle,
        amount: Number(editAmount),
        category: editCategory,
        date: editDate,
      })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      fetchTransactions();
    }
  };

  const pengeluaranModalAktif = transactions
    .filter((t) => {
      if (!currentBudget?.start_date || !currentBudget?.end_date) return true;
      return t.date >= currentBudget.start_date && t.date <= currentBudget.end_date;
    })
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const budgetAmount = currentBudget ? Number(currentBudget.amount) : 0;
  const sisaSaldo = budgetAmount - pengeluaranModalAktif;

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'}`}>
      <main className="max-w-sm mx-auto p-4 space-y-4 font-sans">
        
        {/* Bar Atas: Judul & Tombol Toggle Tema */}
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-black tracking-wider uppercase opacity-70">Dompet-Ku</span>
          <button
            onClick={toggleTheme}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium flex items-center gap-1.5 transition ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-800 text-amber-300 hover:bg-slate-800' 
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-200 shadow-sm'
            }`}
          >
            <span>{isDarkMode ? '☀️ Mode Terang' : '🌙 Mode Gelap'}</span>
          </button>
        </div>

        {/* Kartu Ringkasan Modal */}
        <div className={`border rounded-3xl p-5 space-y-4 shadow-sm transition ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          
          {/* Switcher Dropdown Modal */}
          <div className="flex items-center gap-2">
            <select
              value={activeBudgetId}
              onChange={(e) => handleSwitchBudget(e.target.value)}
              className={`flex-1 border font-bold text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500 transition ${
                isDarkMode 
                  ? 'bg-slate-950 border-blue-900/60 text-blue-300' 
                  : 'bg-blue-50/60 border-blue-200 text-blue-700'
              }`}
            >
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (Rp {Number(b.amount).toLocaleString('id-ID')})
                </option>
              ))}
              <option value="NEW_BUDGET">+ Tambah Modal Baru...</option>
            </select>

            <button
              onClick={handleOpenEdit}
              className={`text-xs px-3 py-2 rounded-xl border transition ${
                isDarkMode 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              {isEditingBudget ? 'Batal' : 'Edit'}
            </button>
          </div>

          <div>
            <p className="text-[11px] font-bold opacity-60 tracking-wider uppercase">Sisa Saldo</p>
            <h1 className={`text-2xl font-black mt-0.5 ${sisaSaldo < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              Rp {sisaSaldo.toLocaleString('id-ID')}
            </h1>
            {currentBudget && (
              <p className="text-[10px] opacity-60 mt-1">
                Periode: <span className="font-semibold">{currentBudget.start_date}</span> s/d <span className="font-semibold">{currentBudget.end_date}</span>
              </p>
            )}
          </div>

          {/* Form Edit/Tambah Modal */}
          {isEditingBudget && (
            <form onSubmit={handleSaveBudgetForm} className={`p-3.5 rounded-2xl border space-y-2.5 transition ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <p className="text-xs font-bold text-blue-500">
                {isCreatingNewBudget ? 'Tambah Modal Baru' : 'Edit Modal Ini'}
              </p>
              <div>
                <label className="text-[10px] opacity-70 block mb-1">Nama Modal</label>
                <input
                  type="text"
                  placeholder="Contoh: Modal Gaji November"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={`w-full border px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="text-[10px] opacity-70 block mb-1">Nominal Modal (Rp)</label>
                <input
                  type="number"
                  placeholder="Contoh: 3000000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className={`w-full border px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] opacity-70 block mb-1">Mulai Pakai</label>
                  <input
                    type="date"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className={`w-full border px-2 py-1 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[10px] opacity-70 block mb-1">Selesai Pakai</label>
                  <input
                    type="date"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className={`w-full border px-2 py-1 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
              
              <div className="flex gap-2 pt-1">
                {!isCreatingNewBudget && budgets.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDeleteBudget}
                    className="bg-rose-500/10 text-rose-500 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-rose-500/20 transition"
                  >
                    Hapus
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded-xl text-xs font-semibold"
                >
                  {isCreatingNewBudget ? 'Simpan Modal Baru' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          )}

          <div className={`grid grid-cols-2 gap-2 pt-3 border-t text-xs ${
            isDarkMode ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <div>
              <span className="opacity-60">Modal: </span>
              <span className="font-semibold">Rp {budgetAmount.toLocaleString('id-ID')}</span>
            </div>
            <div className="text-right">
              <span className="opacity-60">Terpakai: </span>
              <span className="font-semibold text-rose-500">Rp {pengeluaranModalAktif.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Tombol Tambah Transaksi */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white py-2.5 rounded-2xl font-semibold text-xs tracking-wide shadow transition flex items-center justify-center gap-1.5"
        >
          <span>{showAddForm ? '✕ Tutup Form' : '+ Catat Pengeluaran Baru'}</span>
        </button>

        {/* Form Input Transaksi */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className={`border p-4 rounded-3xl space-y-3 shadow-sm transition ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <input
              type="text"
              placeholder="Untuk apa? (Contoh: Beli Kopi)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full border px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
              }`}
              autoFocus
            />

            <input
              type="number"
              placeholder="Nominal (Rp)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full border px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
              }`}
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`border px-2 py-2 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="Makanan">Makanan</option>
                <option value="Transport">Transport</option>
                <option value="Hiburan">Hiburan</option>
                <option value="Tagihan">Tagihan</option>
              </select>

              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`border px-2 py-2 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan Transaksi'}
            </button>
          </form>
        )}

        {/* Filter Riwayat */}
        <div className={`flex items-center justify-between gap-1 border p-1 rounded-2xl transition ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <button
            onClick={() => setFilterMode('all')}
            className={`flex-1 py-1.5 text-[11px] rounded-xl font-medium transition ${
              filterMode === 'all'
                ? isDarkMode ? 'bg-slate-800 text-white font-bold' : 'bg-slate-200 text-slate-900 font-bold'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterMode('month')}
            className={`flex-1 py-1.5 text-[11px] rounded-xl font-medium transition ${
              filterMode === 'month'
                ? isDarkMode ? 'bg-slate-800 text-white font-bold' : 'bg-slate-200 text-slate-900 font-bold'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            Bulan
          </button>
          <button
            onClick={() => setFilterMode('custom')}
            className={`flex-1 py-1.5 text-[11px] rounded-xl font-medium transition ${
              filterMode === 'custom'
                ? isDarkMode ? 'bg-slate-800 text-white font-bold' : 'bg-slate-200 text-slate-900 font-bold'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            Kustom
          </button>
        </div>

        {filterMode === 'month' && (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={`w-full border px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-800'
            }`}
          />
        )}

        {filterMode === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`border px-2 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-800'
              }`}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`border px-2 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-800'
              }`}
            />
          </div>
        )}

        {/* Riwayat Transaksi */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center px-1">
            <p className="text-xs font-bold opacity-60">Riwayat</p>
            <span className="text-[11px] opacity-50">{transactions.length} baris</span>
          </div>

          {transactions.length === 0 ? (
            <p className={`text-xs opacity-50 text-center py-6 border rounded-2xl ${
              isDarkMode ? 'bg-slate-900/50 border-slate-800/80' : 'bg-white border-slate-200'
            }`}>
              Tidak ada transaksi.
            </p>
          ) : (
            transactions.map((t) => (
              <div
                key={t.id}
                className={`border p-3.5 rounded-2xl space-y-2.5 transition ${
                  isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                {editingId === t.id ? (
                  /* Form Edit Transaksi */
                  <form onSubmit={(e) => handleUpdateTransaction(e, t.id)} className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={`w-full border px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                        isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className={`border px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                          isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className={`border px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                          isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                        }`}
                      >
                        <option value="Makanan">Makanan</option>
                        <option value="Transport">Transport</option>
                        <option value="Hiburan">Hiburan</option>
                        <option value="Tagihan">Tagihan</option>
                      </select>
                    </div>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className={`w-full border px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500 ${
                        isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                      }`}
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className={`text-[11px] px-3 py-1 rounded-xl transition ${
                          isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-xl font-semibold transition"
                      >
                        Simpan
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Tampilan Normal Baris Transaksi */
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-xs">{t.title}</p>
                      <p className="text-[10px] opacity-60 mt-0.5">{t.category} • {t.date}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-xs font-bold text-rose-500">
                        -Rp {Number(t.amount).toLocaleString('id-ID')}
                      </p>
                      <div className={`flex items-center gap-1 pl-1 border-l ${
                        isDarkMode ? 'border-slate-800' : 'border-slate-200'
                      }`}>
                        <button
                          onClick={() => startEditingTransaction(t)}
                          title="Edit transaksi"
                          className="text-[11px] opacity-60 hover:opacity-100 hover:text-blue-500 px-1.5 py-1 rounded-lg transition"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(t.id)}
                          title="Hapus transaksi"
                          className="text-[11px] opacity-60 hover:opacity-100 hover:text-rose-500 px-1.5 py-1 rounded-lg transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}