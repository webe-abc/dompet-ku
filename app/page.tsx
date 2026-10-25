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
            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase