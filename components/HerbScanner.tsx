
import React, { useState, useRef, useEffect } from 'react';
import { identifyHerb, generateHerbImage, getStakeholderDetails, findLocalStockists } from '../services/geminiService';
import { exportToPdf } from '../services/pdfService';
import { HerbInfo, AppState, FavoriteItem, StakeholderInfo, ShopInfo } from '../types';

const HerbScanner: React.FC = () => {
  const [state, setState] = useState<AppState>({
    loading: false,
    error: null,
    result: null,
    generatedImageUrl: null,
    sourceImage: null
  });

  const [inputText, setInputText] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  
  // Local shops state
  const [localShops, setLocalShops] = useState<ShopInfo[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);

  // Stakeholder details state
  const [activeStakeholder, setActiveStakeholder] = useState<StakeholderInfo | null>(null);
  const [stakeholderLoading, setStakeholderLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  useEffect(() => {
    localStorage.setItem('herbalist_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (isCameraActive && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error("Error playing video:", err);
        setState(prev => ({ ...prev, error: "Failed to play video stream." }));
      });
    }
  }, [isCameraActive, stream]);

  const startCamera = async () => {
    setState(prev => ({ ...prev, error: null }));
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (err) {
      setState(prev => ({ ...prev, error: "Unable to access camera." }));
    }
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsCameraActive(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        handleIdentification({ imageBase64: canvas.toDataURL('image/jpeg', 0.8) });
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => handleIdentification({ imageBase64: event.target?.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleIdentification = async (input: { text?: string, imageBase64?: string }) => {
    setShowFavorites(false);
    setLocalShops([]);
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null, 
      result: null, 
      generatedImageUrl: null, 
      sourceImage: input.imageBase64 || null 
    }));
    
    try {
      const result = await identifyHerb(input);
      let generatedImg = null;

      if (result.isRelevantBotanical) {
        if (!input.imageBase64) {
          generatedImg = await generateHerbImage(result.name);
        }
        
        // Fetch location and local shops in background
        fetchNearbyShops(result.name);
      }

      setState(prev => ({
        ...prev,
        loading: false,
        result,
        generatedImageUrl: generatedImg
      }));
      
      setTimeout(() => {
        document.getElementById('result-content')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message || "Something went wrong." }));
    }
  };

  const fetchNearbyShops = (herbName: string) => {
    setShopsLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const shops = await findLocalStockists(herbName, position.coords.latitude, position.coords.longitude);
            setLocalShops(shops);
          } catch (err) {
            console.error("Error finding shops:", err);
          } finally {
            setShopsLoading(false);
          }
        },
        (error) => {
          console.warn("Geolocation blocked:", error);
          setShopsLoading(false);
        },
        { timeout: 10000 }
      );
    } else {
      setShopsLoading(false);
    }
  };

  const handleStakeholderClick = async (name: string) => {
    if (!state.result) return;
    setStakeholderLoading(true);
    try {
      const details = await getStakeholderDetails(name, state.result.name);
      setActiveStakeholder(details);
    } catch (err) {
      console.error("Error fetching stakeholder details:", err);
    } finally {
      setStakeholderLoading(false);
    }
  };

  const handleTextSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) handleIdentification({ text: inputText });
  };

  const handleStartOver = () => {
    setState({ loading: false, error: null, result: null, generatedImageUrl: null, sourceImage: null });
    setInputText('');
    setShowFavorites(false);
    setLocalShops([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFavorite = () => {
    if (!state.result || !state.result.recipe) return;
    const isFav = favorites.some(f => f.herbName === state.result!.name);
    if (isFav) {
      setFavorites(favorites.filter(f => f.herbName !== state.result!.name));
    } else {
      setFavorites([{
        herbName: state.result.name,
        scientificName: state.result.scientificName,
        recipe: state.result.recipe,
        timestamp: Date.now()
      }, ...favorites]);
    }
  };

  const isCurrentFavorite = state.result && favorites.some(f => f.herbName === state.result!.name);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold font-serif text-emerald-900">HerbalistAI</h1>
        <p className="text-stone-600 italic">Discover nature's botanical wisdom and local availability.</p>
      </div>

      {/* Action Bar */}
      {!state.result && !state.loading && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={`px-6 py-2 rounded-full font-medium transition-all flex items-center space-x-2 border ${showFavorites ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'}`}
          >
            <i className="fas fa-bookmark"></i>
            <span>Saved Recipes ({favorites.length})</span>
          </button>
        </div>
      )}

      {/* Input Methods */}
      {!showFavorites && !state.result && !state.loading && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 space-y-6 animate-in fade-in duration-300">
          <form onSubmit={handleTextSearch} className="relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type plant name (e.g. Rosemary, Neem, Ashwagandha)..."
              className="w-full pl-4 pr-12 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
            <button type="submit" className="absolute right-2 top-2 p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
              <i className="fas fa-search"></i>
            </button>
          </form>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={startCamera} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-stone-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
              <i className="fas fa-camera text-2xl mb-2 text-stone-400 group-hover:text-emerald-600"></i>
              <span className="text-sm font-medium text-stone-600 group-hover:text-emerald-700">Capture Image</span>
            </button>
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-stone-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group cursor-pointer">
              <i className="fas fa-upload text-2xl mb-2 text-stone-400 group-hover:text-emerald-600"></i>
              <span className="text-sm font-medium text-stone-600 group-hover:text-emerald-700">Upload Photo</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {/* Favorites View */}
      {showFavorites && !state.result && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <h3 className="text-2xl font-bold font-serif text-stone-800">Saved Botanical Recipes</h3>
            <button onClick={() => setShowFavorites(false)} className="text-stone-400 hover:text-stone-600"><i className="fas fa-times"></i></button>
          </div>
          {favorites.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 border-dashed text-stone-500">Your collection is empty.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {favorites.map((fav, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm hover:shadow-md transition-all group relative">
                   <button onClick={() => setFavorites(favorites.filter(f => f.herbName !== fav.herbName))} className="absolute top-4 right-4 text-stone-300 hover:text-red-500"><i className="fas fa-trash-alt"></i></button>
                  <h4 className="text-xl font-bold text-emerald-900 font-serif">{fav.herbName}</h4>
                  <p className="text-stone-400 italic text-xs mb-4">{fav.scientificName}</p>
                  <button onClick={() => handleIdentification({ text: fav.herbName })} className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-100 transition-colors">View Full Guide</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result Display */}
      {state.result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="flex justify-between items-center no-pdf">
            <button onClick={handleStartOver} className="flex items-center space-x-2 px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg transition-colors font-medium text-sm">
              <i className="fas fa-rotate-left"></i><span>New Search</span>
            </button>
            <button onClick={() => exportToPdf('result-content', `Botanical_${state.result?.name}`)} className="bg-emerald-900 text-white px-4 py-2 rounded-lg hover:bg-black transition-all flex items-center shadow-lg text-sm">
              <i className="fas fa-download mr-2"></i>Export PDF
            </button>
          </div>

          <div id="result-content" className="bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden">
            {/* Image & Main Info */}
            <div className="relative h-64 sm:h-80 bg-stone-200">
              {(state.sourceImage || state.generatedImageUrl) && (
                <img src={state.sourceImage || state.generatedImageUrl || ''} alt={state.result.name} className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
                <h2 className="text-3xl font-bold text-white font-serif">{state.result.name}</h2>
                <p className="text-emerald-300 italic">{state.result.scientificName}</p>
                <div className="flex flex-wrap gap-4 mt-2 text-white/80 text-xs">
                  {state.result.placeOfOrigin && <span className="flex items-center"><i className="fas fa-seedling mr-2"></i>{state.result.placeOfOrigin}</span>}
                  {state.result.leadingProducer && <span className="flex items-center"><i className="fas fa-globe-americas mr-2"></i>{state.result.leadingProducer}</span>}
                </div>
              </div>
            </div>

            <div className="p-8 space-y-10">
              <p className="text-stone-700 leading-relaxed text-lg italic">"{state.result.description}"</p>

              {/* Local Availability Section */}
              <section className="bg-stone-50 p-6 rounded-2xl border border-stone-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-stone-900 font-serif flex items-center">
                    <i className="fas fa-map-location-dot text-emerald-600 mr-3"></i>
                    Local Availability (Within 5km)
                  </h3>
                  {shopsLoading && <i className="fas fa-circle-notch fa-spin text-emerald-500"></i>}
                </div>

                {localShops.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {localShops.map((shop, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-all">
                        <h4 className="font-bold text-emerald-900 mb-1">{shop.name}</h4>
                        <p className="text-stone-500 text-xs mb-3 line-clamp-1">{shop.address}</p>
                        <a 
                          href={shop.uri} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700"
                        >
                          <i className="fas fa-directions mr-1.5"></i> Open in Maps
                        </a>
                      </div>
                    ))}
                  </div>
                ) : !shopsLoading ? (
                  <div className="bg-stone-100/50 p-4 rounded-xl text-center text-stone-500 text-sm italic">
                    <i className="fas fa-info-circle mr-2"></i>
                    No specific stockists identified nearby. Try local spice markets or specialized organic nurseries.
                  </div>
                ) : (
                  <div className="animate-pulse flex flex-col items-center py-4">
                    <div className="h-4 w-48 bg-stone-200 rounded mb-2"></div>
                    <div className="h-3 w-32 bg-stone-200 rounded"></div>
                  </div>
                )}
              </section>

              {/* Existing Sections... */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-stone-800 border-b pb-2 font-serif">Health Benefits</h3>
                  <div className="space-y-2">
                    {state.result.benefits?.map((benefit, idx) => (
                      <div key={idx} className="flex items-start text-sm">
                        <i className="fas fa-check-circle text-emerald-600 mt-1 mr-3"></i>
                        <span className="text-stone-700">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-stone-800 border-b pb-2 font-serif">Major Industry Stakeholders</h3>
                  <div className="flex flex-wrap gap-2">
                    {state.result.majorStakeholders?.map((holder, idx) => (
                      <button key={idx} onClick={() => handleStakeholderClick(holder)} className="bg-stone-100 px-3 py-1.5 rounded-full text-xs font-medium text-stone-600 hover:bg-emerald-100 hover:text-emerald-800 transition-colors">
                        {holder}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {state.result.recipe && (
                <section className="bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100 relative">
                  <h3 className="text-2xl font-bold text-emerald-900 font-serif mb-6 flex items-center">
                    <i className="fas fa-mortar-pestle mr-4"></i>{state.result.recipe.title}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-3">Ingredients</h4>
                      <ul className="space-y-2 text-sm text-stone-700">
                        {state.result.recipe.ingredients.map((ing, idx) => <li key={idx} className="flex items-center"><i className="fas fa-plus text-[8px] mr-3 text-emerald-400"></i>{ing}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-3">Preparation</h4>
                      <ol className="space-y-4 text-sm text-stone-700">
                        {state.result.recipe.steps.map((step, idx) => <li key={idx} className="flex"><span className="font-black mr-4 text-emerald-600">{idx+1}</span>{step}</li>)}
                      </ol>
                    </div>
                  </div>
                  <button onClick={toggleFavorite} className={`absolute top-6 right-8 text-2xl ${isCurrentFavorite ? 'text-emerald-600' : 'text-stone-300 hover:text-emerald-400'}`}>
                    <i className={`${isCurrentFavorite ? 'fas' : 'far'} fa-heart`}></i>
                  </button>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Corporate Profile Modal */}
      {activeStakeholder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-stone-200">
            <div className="bg-emerald-900 p-8 text-white relative">
              <button onClick={() => setActiveStakeholder(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><i className="fas fa-times"></i></button>
              <h3 className="text-2xl font-bold font-serif leading-tight">{activeStakeholder.name}</h3>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <i className="fas fa-location-dot text-emerald-700 mt-1"></i>
                  <div><h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Headquarters</h4><p className="text-stone-800 font-medium text-sm">{activeStakeholder.address}</p></div>
                </div>
                <div className="flex items-start space-x-4">
                  <i className="fas fa-phone text-emerald-700 mt-1"></i>
                  <div><h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Contact</h4><p className="text-stone-800 font-medium text-sm">{activeStakeholder.contactNumber}</p></div>
                </div>
              </div>
              <button onClick={() => setActiveStakeholder(null)} className="w-full py-3 bg-stone-100 text-stone-700 rounded-xl font-bold hover:bg-stone-200 transition-colors">Close Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* Stakeholder / Generic Loading Overlay */}
      {(state.loading || stakeholderLoading) && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md">
           <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-100 border-t-emerald-600"></div>
           <p className="mt-4 text-emerald-900 font-bold font-serif">Consulting Botanical Records...</p>
        </div>
      )}

      {/* Camera Modal */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="relative w-full max-w-lg aspect-video bg-stone-900 rounded-2xl overflow-hidden shadow-2xl">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute bottom-6 left-0 right-0 flex justify-center space-x-6">
              <button onClick={stopCamera} className="w-12 h-12 rounded-full bg-stone-800 text-white flex items-center justify-center"><i className="fas fa-times"></i></button>
              <button onClick={captureImage} className="w-16 h-16 rounded-full bg-white border-4 border-emerald-500 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-emerald-600"></div>
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}
    </div>
  );
};

export default HerbScanner;
