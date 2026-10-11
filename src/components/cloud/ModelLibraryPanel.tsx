"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { CloudModelItem, UserTier } from '@/types/model';
import { Search, Download, Heart, Layers, Sparkles, Lock, Globe } from 'lucide-react';

interface ModelLibraryPanelProps {
  onLoadModel: (modelUrl: string, title: string) => void;
  userTier: UserTier;
}

const MOCK_CLOUD_MODELS: CloudModelItem[] = [
  {
    id: '1',
    title: 'Cyberpunk Figurine & Base',
    category: 'Figures',
    author: 'CrealityStudio3D',
    downloads: 1420,
    likes: 389,
    image: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&q=80',
    gcodeAvailable: true,
    description: 'Detailed standing action character figurine optimized for zero-support FDM printing.'
  },
  {
    id: '2',
    title: 'Articulated Dragon',
    category: 'Miniatures',
    author: 'PolycamSculpt',
    downloads: 2890,
    likes: 812,
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
    gcodeAvailable: true,
    isPremiumOnly: true,
    description: 'Print-in-place flexible dragon model with interlocking joints.'
  },
  {
    id: '3',
    title: 'Modern Geometric Planter Pot',
    category: 'Household',
    author: 'TinkerCadDesigns',
    downloads: 870,
    likes: 210,
    image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=400&q=80',
    gcodeAvailable: true,
    description: 'Minimalist low-poly vase design with integrated drainage plate.'
  },
  {
    id: '4',
    title: 'Engine Piston Mechanical Desk Toy',
    category: 'Tools',
    author: 'PrusaMakerHub',
    downloads: 650,
    likes: 175,
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&q=80',
    gcodeAvailable: false,
    description: 'Functional multi-part mechanical assembly with smooth rotating gears.'
  }
];

export const ModelLibraryPanel: React.FC<ModelLibraryPanelProps> = ({ onLoadModel, userTier }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', 'Figures', 'Miniatures', 'Household', 'Tools'];

  const filteredModels = MOCK_CLOUD_MODELS.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2 text-sky-400">
            <Globe className="w-5 h-5" /> Creality Cloud Model Store
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Browse trending 3D models, miniatures, and community prints ready for instant slicing.
          </p>
        </div>
      </div>

      {/* Search Bar & Category Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Creality Cloud models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-sky-500 text-slate-100"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition shrink-0 ${
                activeCategory === cat
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Models List Grid */}
      <div className="grid grid-cols-1 gap-3 max-h-[420px] overflow-y-auto pr-1">
        {filteredModels.map((model) => {
          const isLocked = model.isPremiumOnly && userTier === 'free';
          return (
            <div
              key={model.id}
              className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex gap-3 hover:border-slate-700 transition"
            >
              <Image
                src={model.image}
                alt={model.title}
                width={80}
                height={80}
                unoptimized
                className="w-20 h-20 rounded-lg object-cover bg-slate-900 border border-slate-800 shrink-0"
              />
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-xs text-slate-200 truncate">{model.title}</h4>
                    {model.isPremiumOnly && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5 shrink-0">
                        {isLocked ? <Lock className="w-2.5 h-2.5" /> : <Sparkles className="w-2.5 h-2.5" />} PRO
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">by @{model.author}</p>
                  <p className="text-[11px] text-slate-300 line-clamp-1 mt-1">{model.description}</p>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900 text-[10px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3 text-sky-400" /> {model.downloads}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-rose-400" /> {model.likes}
                    </span>
                  </div>

                  <button
                    onClick={() => onLoadModel(model.id, model.title)}
                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium flex items-center gap-1 text-[10px] transition shadow"
                  >
                    <Layers className="w-3 h-3" /> Load in Studio
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
