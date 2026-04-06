
import React, { useState, useEffect } from 'react';
import HerbScanner from './components/HerbScanner';
import RemedyAdvisor from './components/RemedyAdvisor';
import { FavoriteItem } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'explore' | 'remedies'>('explore');
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('herbalist_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  const handleSaveFavorite = (item: FavoriteItem) => {
    setFavorites(prev => {
      const isExisting = prev.some(f => f.recipe.title === item.recipe.title);
      const newFavs = isExisting 
        ? prev.filter(f => f.recipe.title !== item.recipe.title)
        : [item, ...prev];
      
      localStorage.setItem('herbalist_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  return (
    <div className="min-h-screen pb-20 bg-stone-50">
      {/* Navigation / Header */}
      <nav className="bg-white border-b border-stone-200 py-4 sticky top-0 z-40 backdrop-blur-md bg-white/80">
        <div className="max-w-4xl mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-leaf text-white text-sm"></i>
            </div>
            <span className="font-serif font-bold text-emerald-900 text-xl tracking-tight">HerbalistAI</span>
          </div>
          
          <div className="flex items-center space-x-1 p-1 bg-stone-100 rounded-xl">
            <button
              onClick={() => setActiveTab('explore')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'explore' ? 'bg-white text-emerald-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
            >
              Explore
            </button>
            <button
              onClick={() => setActiveTab('remedies')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'remedies' ? 'bg-white text-emerald-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
            >
              Remedies
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mt-8 px-4">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'explore' ? (
            <HerbScanner />
          ) : (
            <RemedyAdvisor 
              favorites={favorites} 
              onSaveRecipe={handleSaveFavorite} 
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 py-8 border-t border-stone-200 bg-stone-100">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-stone-500 text-sm">
            © {new Date().getFullYear()} HerbalistAI. Powered by Gemini Generative AI.
          </p>
          <p className="text-stone-400 text-xs mt-2">
            Information provided for educational purposes. Consult a professional before medicinal use.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
