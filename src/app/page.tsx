'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, ShoppingBag, Tag, TrendingUp, AlertCircle, CheckCircle2, Layers, ExternalLink, Sun, Moon, Check, Clock } from 'lucide-react'
import { Toaster, toast } from 'sonner'

interface ItemSource {
  id: string
  platform: string
  price: number
  product_url: string
}

interface Item {
  id: string
  name: string
  category: string
  notes: string
  target_margin_percent: number
  is_ordered: boolean
  sources: ItemSource[]
}

export default function Home() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(true)

  // Form states
  const [name, setName] = useState('')
  const [category, setCategory] = useState('General')
  const [notes, setNotes] = useState('')
  const [targetMargin, setTargetMargin] = useState(25)
  
  // Platform inputs
  const [sources, setSources] = useState<{ platform: string; price: string; product_url: string }[]>([
    { platform: 'Shopee', price: '', product_url: '' },
    { platform: 'TikTok Shop', price: '', product_url: '' },
    { platform: 'Pinduoduo', price: '', product_url: '' },
    { platform: 'Lazada', price: '', product_url: '' }
  ])

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    const { data: itemsData, error: itemsError } = await supabase.from('items').select('*').order('created_at', { ascending: false })
    
    if (itemsError) {
      console.error('Error fetching items:', itemsError)
      toast.error('Failed to load inventory items.')
      setLoading(false)
      return
    }

    const fullItems: Item[] = []
    for (const item of itemsData || []) {
      const { data: sourcesData } = await supabase.from('item_sources').select('*').eq('item_id', item.id)
      fullItems.push({
        ...item,
        is_ordered: item.is_ordered ?? false,
        sources: sourcesData || []
      })
    }

    setItems(fullItems)
    setLoading(false)
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.warning('Please enter an item name.')
      return
    }

    const promise = async () => {
      const { data: insertedItem, error: itemError } = await supabase
        .from('items')
        .insert([{ name, category, notes, target_margin_percent: targetMargin, is_ordered: false }])
        .select()
        .single()

      if (itemError || !insertedItem) throw new Error('Error creating item')

      const validSources = sources
        .filter(s => s.price && Number(s.price) > 0)
        .map(s => ({
          item_id: insertedItem.id,
          platform: s.platform,
          price: Number(s.price),
          product_url: s.product_url
        }))

      if (validSources.length > 0) {
        const { error: sourceError } = await supabase.from('item_sources').insert(validSources)
        if (sourceError) throw new Error('Error saving platform rates')
      }

      setName('')
      setNotes('')
      setSources([
        { platform: 'Shopee', price: '', product_url: '' },
        { platform: 'TikTok Shop', price: '', product_url: '' },
        { platform: 'Pinduoduo', price: '', product_url: '' },
        { platform: 'Lazada', price: '', product_url: '' }
      ])
      fetchItems()
    }

    toast.promise(promise(), {
      loading: 'Saving & analyzing item...',
      success: 'Item successfully saved!',
      error: (err: any) => err.message || 'Failed to save item.'
    })
  }

  async function handleToggleOrdered(id: string, currentStatus: boolean) {
    const newStatus = !currentStatus
    
    // Optimistic UI update
    setItems(items.map(item => item.id === id ? { ...item, is_ordered: newStatus } : item))

    const { error } = await supabase
      .from('items')
      .update({ is_ordered: newStatus })
      .eq('id', id)

    if (error) {
      // Revert if error
      setItems(items.map(item => item.id === id ? { ...item, is_ordered: currentStatus } : item))
      toast.error('Failed to update order status.')
    } else {
      toast.success(newStatus ? 'Marked as Ordered!' : 'Marked as Not Ordered.')
    }
  }

  async function handleDeleteItem(id: string) {
    const promise = async () => {
      const { error } = await supabase.from('items').delete().eq('id', id)
      if (error) throw new Error('Failed to delete item')
      fetchItems()
    }

    toast.promise(promise(), {
      loading: 'Deleting item...',
      success: 'Item removed from inventory.',
      error: 'Failed to delete item.'
    })
  }

  // Custom platform brand color styling for inventory cards
  function getPlatformStyle(platform: string) {
    const p = platform.toLowerCase()
    
    if (p.includes('shopee')) {
      return 'bg-orange-500 text-white border-orange-600 shadow-sm'
    }
    if (p.includes('tiktok')) {
      return 'bg-black text-white border-zinc-800 ring-2 ring-red-500/60 shadow-md'
    }
    if (p.includes('pinduoduo')) {
      return 'bg-white text-red-600 border-red-200 shadow-sm font-semibold'
    }
    if (p.includes('lazada')) {
      return 'bg-blue-600 text-white border-blue-700 shadow-sm'
    }
    
    return 'bg-slate-900 text-slate-300 border-slate-800'
  }

  // Custom styling specifically for the Input Sidebar platform boxes
  function getInputCardStyle(platform: string) {
    const p = platform.toLowerCase()
    
    if (p.includes('shopee')) {
      return 'bg-orange-500/10 border-orange-500/30 text-orange-400'
    }
    if (p.includes('tiktok')) {
      return 'bg-zinc-900 border-red-500/40 text-white ring-1 ring-red-500/30'
    }
    if (p.includes('pinduoduo')) {
      return 'bg-red-500/10 border-red-500/30 text-red-400'
    }
    if (p.includes('lazada')) {
      return 'bg-blue-500/10 border-blue-500/30 text-blue-400'
    }
    
    return darkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
  }

  const totalItemsCount = items.length
  const totalPlatformsTracked = items.reduce((acc, item) => acc + item.sources.filter(s => s.price > 0).length, 0)
  const orderedCount = items.filter(item => item.is_ordered).length

  return (
    <main className={`min-h-screen transition-colors duration-300 font-sans p-4 md:p-10 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <Toaster richColors position="top-right" theme={darkMode ? 'dark' : 'light'} />
      
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header with Theme Switcher */}
        <header className={`flex flex-col md:flex-row justify-between items-start md:items-center border p-6 rounded-3xl shadow-xl gap-6 transition-colors duration-300 ${
          darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-xs font-semibold tracking-wide uppercase border border-indigo-500/20">
              <ShoppingBag className="w-3.5 h-3.5" /> Retail Intelligence Suite
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Mama&apos;s Price Comparison
            </h1>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Cross-border price scanning & smart retail margin calculator across TikTok, Shopee, & Pinduoduo.
            </p>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="flex gap-3">
              <div className={`px-4 py-2.5 rounded-2xl border text-center ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                <span className={`text-[10px] uppercase block ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Items</span>
                <span className="text-xl font-black text-indigo-500">{totalItemsCount}</span>
              </div>
              <div className={`px-4 py-2.5 rounded-2xl border text-center ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                <span className={`text-[10px] uppercase block ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Ordered</span>
                <span className="text-xl font-black text-emerald-500">{orderedCount}</span>
              </div>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-center ${
                darkMode ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200'
              }`}
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Form Sidebar */}
          <div className="lg:col-span-1">
            <div className={`border rounded-3xl p-6 shadow-xl sticky top-6 space-y-6 transition-colors duration-300 ${
              darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className={`flex items-center gap-2.5 font-bold text-lg border-b pb-4 ${darkMode ? 'text-indigo-400 border-slate-800' : 'text-indigo-600 border-slate-100'}`}>
                <Plus className="w-5 h-5 bg-indigo-500/10 p-1 rounded-lg text-indigo-500" /> Log New Item
              </div>

              <form onSubmit={handleAddItem} className="space-y-4">
                <div>
                  <label className={`block text-xs uppercase tracking-wider font-semibold mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Item Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Mechanical Keyboard"
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition ${
                      darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs uppercase tracking-wider font-semibold mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Category</label>
                    <input
                      type="text"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      placeholder="e.g. Tech"
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition ${
                        darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs uppercase tracking-wider font-semibold mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Margin (%)</label>
                    <input
                      type="number"
                      value={targetMargin}
                      onChange={e => setTargetMargin(Number(e.target.value))}
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition ${
                        darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <label className={`block text-xs uppercase tracking-wider font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Platform Rates (₱)</label>
                  <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                    {sources.map((src, idx) => {
                      const inputCardStyle = getInputCardStyle(src.platform)
                      return (
                        <div key={idx} className={`border p-3 rounded-2xl space-y-2 transition-colors ${inputCardStyle}`}>
                          <div className="text-xs font-black tracking-wide uppercase drop-shadow-sm">{src.platform}</div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Price"
                              value={src.price}
                              onChange={e => {
                                const newSources = [...sources]
                                newSources[idx].price = e.target.value
                                setSources(newSources)
                              }}
                              className={`border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 ${
                                darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                              }`}
                            />
                            <input
                              type="text"
                              placeholder="URL link"
                              value={src.product_url}
                              onChange={e => {
                                const newSources = [...sources]
                                newSources[idx].product_url = e.target.value
                                setSources(newSources)
                              }}
                              className={`border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 truncate ${
                                darkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-300 text-slate-600'
                              }`}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className={`block text-xs uppercase tracking-wider font-semibold mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Notes & Reminders</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Free shipping on weekends..."
                    rows={2}
                    className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition resize-none ${
                      darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold px-6 py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Save & Analyze Item
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Inventory Grid */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-500" /> Monitored Inventory ({items.length})
              </h2>
            </div>

            {loading ? (
              <div className={`border rounded-3xl p-16 text-center ${darkMode ? 'bg-slate-900/50 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400'}`}>
                Synchronizing items from database...
              </div>
            ) : items.length === 0 ? (
              <div className={`border rounded-3xl p-16 text-center space-y-2 ${darkMode ? 'bg-slate-900/50 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400'}`}>
                <Layers className="w-10 h-10 mx-auto opacity-50" />
                <p className="font-medium">No items added yet.</p>
                <p className="text-xs opacity-75">Use the sidebar form to add your first product to compare!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {items.map(item => {
                  const validPrices = item.sources.map(s => Number(s.price)).filter(p => p > 0)
                  const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0
                  const highestPrice = validPrices.length > 0 ? Math.max(...validPrices) : 0
                  
                  const calculatedMarkupPrice = lowestPrice * (1 + (item.target_margin_percent || 25) / 100)
                  const suggestedSellingPrice = highestPrice > 0 ? Math.min(calculatedMarkupPrice, highestPrice) : calculatedMarkupPrice

                  return (
                    <div key={item.id} className={`border rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-5 transition ${
                      darkMode ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}>
                      <div className="space-y-4">
                        
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded-full font-bold border ${
                                darkMode ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                                {item.category || 'General'}
                              </span>

                              {/* Ordered Status Badge Button */}
                              <button
                                onClick={() => handleToggleOrdered(item.id, item.is_ordered)}
                                className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-extrabold border transition flex items-center gap-1 cursor-pointer shadow-sm ${
                                  item.is_ordered
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                                }`}
                                title="Click to toggle order status"
                              >
                                {item.is_ordered ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" /> Ordered
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3 text-amber-400" /> Not Ordered
                                  </>
                                )}
                              </button>
                            </div>

                            <h3 className="text-lg font-bold pt-1">{item.name}</h3>
                          </div>

                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className={`p-2 rounded-xl transition cursor-pointer ${
                              darkMode ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800/60' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'
                            }`}
                            title="Delete Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <span className={`text-[11px] font-semibold uppercase tracking-wider block ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Market Prices</span>
                          <div className="grid grid-cols-2 gap-2.5">
                            {item.sources.map(src => {
                              const isLowest = src.price === lowestPrice && lowestPrice > 0
                              const platformStyling = getPlatformStyle(src.platform)
                              return (
                                <div
                                  key={src.id}
                                  className={`p-3 rounded-2xl border transition ${platformStyling}`}
                                >
                                  <div className="text-[10px] uppercase font-bold tracking-wide flex items-center justify-between opacity-95">
                                    {src.platform}
                                    {isLowest && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 drop-shadow" />}
                                  </div>
                                  <div className="text-base font-extrabold mt-1">
                                    {src.price > 0 ? `₱${src.price.toFixed(2)}` : 'N/A'}
                                  </div>
                                  {src.product_url && (
                                    <a
                                      href={src.product_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] underline opacity-85 hover:opacity-100 flex items-center gap-1 mt-1 truncate"
                                    >
                                      <span>Link</span> <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div className={`border rounded-2xl p-4 space-y-3 ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-wider">
                            <TrendingUp className="w-4 h-4" /> Smart Price Intelligence
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className={`p-3 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                              <span className={`block text-[10px] uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Lowest Cost</span>
                              <span className="text-base font-black text-indigo-500">₱{lowestPrice.toFixed(2)}</span>
                            </div>
                            <div className={`p-3 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                              <span className={`block text-[10px] uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target Selling</span>
                              <span className="text-base font-black text-violet-500">₱{suggestedSellingPrice.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className={`text-[11px] flex items-center gap-1.5 pt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            <AlertCircle className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                            <span>Calculated with {item.target_margin_percent}% markup, capped safely under market ceiling (₱{highestPrice.toFixed(2)}).</span>
                          </div>
                        </div>

                        {item.notes && (
                          <div className={`text-xs p-3 rounded-xl border italic ${
                            darkMode ? 'text-slate-400 bg-slate-950/40 border-slate-900' : 'text-slate-600 bg-white border-slate-200'
                          }`}>
                            <strong className={`not-italic font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-800'}`}>Notes:</strong> {item.notes}
                          </div>
                        )}

                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  )
}