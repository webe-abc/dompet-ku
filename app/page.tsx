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

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [initialBudget, setInitialBudget] = useState<number>(0);
  const [tempBudget, setTempBudget] = useState<string>('');
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form input
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makanan');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter
  const [filterMode, setFilterMode] = useState<'all' | 'month' | 'custom'>('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Set nilai tanggal default di sisi browser (mencegah error prerender Next.js)
  useEffect(() => {
    const today = new Date().toISOString();
    setDate(today.split('T')[0]);
    setSelectedMonth(today.slice(0, 7));
  }, []);

  // Tarik data transaksi dengan filter
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
    const saved = localStorage.getItem('initial_budget');
    if (saved) {
      setInitialBudget(Number(saved));
      setTempBudget(saved);
    }
  }, [fetchTransactions]);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(tempBudget) || 0;
    setInitialBudget(val);
    localStorage.setItem('initial_budget', val.toString());
    setIsEditingBudget(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;

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

  const totalPengeluaran = transactions.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const sisaSaldo = initialBudget - totalPengeluaran;

  return (
    <main className="max-w-sm mx-auto p-4 space-y-4 min-h-screen text-slate-100 font-sans">
      {/* Kartu Ringkasan Minimalis */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Sisa Saldo</p>
            <h1 className={`text-2xl font-black mt-0.5 ${sisaSaldo < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              Rp {sisaSaldo.toLocaleString('id-ID')}
            </h1>
          </div>
          <button
            onClick={() => setIsEditingBudget(!isEditingBudget)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700 transition"
          >
            {isEditingBudget ? 'Batal' : 'Atur Modal'}
          </button>
        </div>

        {isEditingBudget && (
          <form onSubmit={handleSaveBudget} className="flex gap-2 pt-1">
            <input
              type="number"
              placeholder="Ketik modal..."
              value={tempBudget}
              onChange={(e) => setTempBudget(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 text-white px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold">
              Simpan
            </button>
          </form>
        )}

        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-400">Modal: </span>
            <span className="font-semibold text-slate-200">Rp {initialBudget.toLocaleString('id-ID')}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Keluar: </span>
            <span className="font-semibold text-rose-400">Rp {totalPengeluaran.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {/* Tombol Buka/Tutup Form Tambah */}
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white py-2.5 rounded-2xl font-semibold text-xs tracking-wide shadow transition flex items-center justify-center gap-1.5"
      >
        <span>{showAddForm ? '✕ Tutup Form' : '+ Catat Pengeluaran Baru'}</span>
      </button>

      {/* Form Tambah Pengeluaran (Kompak) */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-3">
          <input
            type="text"
            placeholder="Untuk apa? (Contoh: Beli Kopi)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />

          <input
            type="number"
            placeholder="Nominal (Rp)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-xl text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 px-2 py-2 rounded-xl text-xs focus:outline-none focus:border-blue-500"
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
              className="bg-slate-950 border border-slate-800 text-slate-200 px-2 py-2 rounded-xl text-xs focus:outline-none focus:border-blue-500"
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

      {/* Filter Ringkas */}
      <div className="flex items-center justify-between gap-1 bg-slate-900 border border-slate-800 p-1 rounded-2xl">
        <button
          onClick={() => setFilterMode('all')}
          className={`flex-1 py-1.5 text-[11px] rounded-xl font-medium transition ${
            filterMode === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Semua
        </button>
        <button
          onClick={() => setFilterMode('month')}
          className={`flex-1 py-1.5 text-[11px] rounded-xl font-medium transition ${
            filterMode === 'month' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Bulan
        </button>
        <button
          onClick={() => setFilterMode('custom')}
          className={`flex-1 py-1.5 text-[11px] rounded-xl font-medium transition ${
            filterMode === 'custom' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
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
          className="w-full bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-blue-500"
        />
      )}

      {filterMode === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white px-2 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white px-2 py-1.5 rounded-xl text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Riwayat Transaksi */}
      <div className="space-y-2 pt-1">
        <div className="flex justify-between items-center px-1">
          <p className="text-xs font-bold text-slate-400">Riwayat</p>
          <span className="text-[11px] text-slate-500">{transactions.length} baris</span>
        </div>

        {transactions.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 bg-slate-900/50 border border-slate-800/80 rounded-2xl">
            Tidak ada transaksi.
          </p>
        ) : (
          transactions.map((t) => (
            <div
              key={t.id}
              className="flex justify-between items-center bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl"
            >
              <div>
                <p className="font-semibold text-xs text-slate-200">{t.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{t.category} • {t.date}</p>
              </div>
              <p className="text-xs font-bold text-rose-400">
                -Rp {Number(t.amount).toLocaleString('id-ID')}
              </p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}