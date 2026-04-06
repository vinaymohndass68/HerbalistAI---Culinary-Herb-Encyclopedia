
import React, { useState, useRef, useEffect } from 'react';
import { getRemedies, askFollowUp, generateProblemCartoon } from '../services/geminiService';
import { exportToPdf } from '../services/pdfService';
import { RemedyResult, FavoriteItem } from '../types';

interface RemedyAdvisorProps {
  onSaveRecipe: (item: FavoriteItem) => void;
  favorites: FavoriteItem[];
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const RemedyAdvisor: React.FC<RemedyAdvisorProps> = ({ onSaveRecipe, favorites }) => {
  const [problem, setProblem] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RemedyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cartoonUrl, setCartoonUrl] = useState<string | null>(null);
  
  const [followUp, setFollowUp] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCameraActive && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => {
          console.error("Camera error:", err);
          setIsCameraActive(false);
          setError("Unable to access camera.");
        });
    }
  }, [isCameraActive]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setSelectedImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        setSelectedImage(canvasRef.current.toDataURL('image/jpeg'));
        
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        setIsCameraActive(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem.trim() && !selectedImage) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setCartoonUrl(null);
    setChatHistory([]);

    try {
      const [remediesData, cartoonData] = await Promise.all([
        getRemedies({ text: problem, imageBase64: selectedImage || undefined }),
        generateProblemCartoon(problem || "health concern")
      ]);
      setResult(remediesData);
      setCartoonUrl(cartoonData);
    } catch (err: any) {
      setError("Unable to gather remedies. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartOver = () => {
    setResult(null);
    setProblem('');
    setSelectedImage(null);
    setError(null);
    setCartoonUrl(null);
    setChatHistory([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUp.trim() || followUpLoading) return;

    const userMsg = followUp;
    setFollowUp('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setFollowUpLoading(true);

    try {
      const response = await askFollowUp(problem || "health concern", chatHistory, userMsg);
      if (response) {
        setChatHistory(prev => [...prev, { role: 'model', text: response }]);
      }
    } catch (err) {
      setError("Failed to get follow-up clarification.");
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleSave = (sol: any) => {
    const newItem: FavoriteItem = {
      herbName: sol.herbName,
      recipe: {
        title: sol.remedyTitle,
        ingredients: sol.ingredients || [],
        steps: sol.preparationSteps || []
      },
      timestamp: Date.now()
    };
    onSaveRecipe(newItem);
  };

  const handleDownloadPdf = async () => {
    if (!result || !containerRef.current) return;
    
    containerRef.current.classList.add('pdf-capture');
    try {
      await exportToPdf('remedy-pdf-container', `HerbalistAI_Remedy_Guide_${(problem || 'visual_consult').slice(0, 20).replace(/\s+/g, '_')}`);
    } finally {
      containerRef.current.classList.remove('pdf-capture');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {!result && !loading && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200 space-y-8">
          <div className="flex items-center space-x-4 text-emerald-800">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
               <i className="fas fa-hand-holding-heart text-2xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold font-serif">Natural Remedy Finder</h2>
              <p className="text-stone-500 text-sm">Upload a photo of your concern or describe it in words.</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="block text-xs font-black text-stone-400 uppercase tracking-widest">Description</label>
                <textarea
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="Describe your symptoms (e.g., 'Dry cough', 'Sore shoulder', 'Trouble sleeping')..."
                  className="w-full p-5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all h-40 resize-none text-stone-800 placeholder:text-stone-400 shadow-inner"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-black text-stone-400 uppercase tracking-widest">Visual Evidence (Optional)</label>
                <div className="h-40 relative group">
                  {selectedImage ? (
                    <div className="w-full h-full rounded-2xl overflow-hidden border border-stone-200 relative">
                      <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-full border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-3 bg-stone-50 group-hover:bg-emerald-50/50 group-hover:border-emerald-200 transition-all">
                      <div className="flex gap-4">
                        <button 
                          type="button" 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-12 h-12 rounded-xl bg-white shadow-sm border border-stone-200 flex items-center justify-center text-stone-400 hover:text-emerald-600 hover:border-emerald-200 transition-all"
                        >
                          <i className="fas fa-image"></i>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setIsCameraActive(true)}
                          className="w-12 h-12 rounded-xl bg-white shadow-sm border border-stone-200 flex items-center justify-center text-stone-400 hover:text-emerald-600 hover:border-emerald-200 transition-all"
                        >
                          <i className="fas fa-camera"></i>
                        </button>
                      </div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Upload or Capture</span>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (!problem.trim() && !selectedImage)}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center space-x-3 shadow-xl shadow-emerald-100 group"
            >
              <i className="fas fa-wand-sparkles group-hover:rotate-12 transition-transform"></i>
              <span>Analyze & Get Remedies</span>
            </button>
          </form>
        </div>
      )}

      {isCameraActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl w-full max-w-lg">
            <div className="relative aspect-video bg-stone-900">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>
            <div className="p-6 flex justify-center gap-6 bg-stone-50">
               <button 
                onClick={() => {
                  if (videoRef.current?.srcObject) {
                    (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                  }
                  setIsCameraActive(false);
                }} 
                className="w-14 h-14 rounded-2xl bg-white border border-stone-200 text-stone-400 hover:text-stone-600 shadow-sm flex items-center justify-center transition-all"
              >
                <i className="fas fa-times"></i>
              </button>
              <button 
                onClick={captureImage} 
                className="w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-100 flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all"
              >
                <i className="fas fa-camera text-xl"></i>
              </button>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 space-y-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-emerald-600"></div>
            <i className="fas fa-mortar-pestle absolute inset-0 flex items-center justify-center text-emerald-600 animate-pulse"></i>
          </div>
          <div className="text-center space-y-2">
            <p className="text-stone-800 font-bold text-xl font-serif">Deep Tissue Analysis...</p>
            <p className="text-stone-500 text-sm max-w-xs">Connecting visual data with traditional botanical science.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-5 bg-red-50 border border-red-100 text-red-800 rounded-2xl flex items-start space-x-4 animate-in slide-in-from-top-4">
          <i className="fas fa-circle-exclamation text-xl mt-0.5"></i>
          <div>
            <p className="font-bold">Consultation Error</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700" ref={containerRef}>
          {/* Action Header */}
          <div className="flex flex-wrap gap-4 justify-between items-center no-pdf">
            <button
              onClick={handleStartOver}
              className="flex items-center space-x-2 px-5 py-2.5 bg-white border border-stone-200 text-stone-600 rounded-xl hover:bg-stone-50 transition-colors font-bold text-sm shadow-sm"
            >
              <i className="fas fa-arrow-left"></i>
              <span>Start New Consult</span>
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleDownloadPdf}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-900 text-white rounded-xl hover:bg-black transition-all shadow-lg font-bold text-sm"
              >
                <i className="fas fa-file-pdf"></i>
                <span>Export Analysis</span>
              </button>
            </div>
          </div>

          <div id="remedy-pdf-container" className="space-y-12 bg-white rounded-[2.5rem] p-1 shadow-2xl border border-stone-100 overflow-hidden">
            
            {/* 1. Report Cover Header */}
            <div className="bg-stone-50 p-10 border-b border-stone-100 flex flex-col md:flex-row items-center gap-10">
              <div className="w-full md:w-2/5 space-y-4">
                {selectedImage && (
                  <div className="aspect-[4/3] bg-white rounded-[2rem] overflow-hidden shadow-inner border border-stone-200 p-2">
                    <img src={selectedImage} alt="Submitted concern" className="w-full h-full object-cover rounded-3xl" />
                    <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest text-center mt-2">Original Patient Submission</p>
                  </div>
                )}
                {cartoonUrl && (
                  <div className="aspect-[16/9] bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 p-2">
                    <img src={cartoonUrl} alt="Visual interpretation" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-6 text-center md:text-left">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em]">Visual Consultation Case #{Math.floor(Math.random() * 9000) + 1000}</span>
                  <h2 className="text-4xl md:text-5xl font-black font-serif text-stone-900 leading-tight">Botanical Relief Guide</h2>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-emerald-100 shadow-sm relative">
                  <i className="fas fa-quote-left absolute -top-3 -left-3 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs"></i>
                  <p className="text-stone-500 text-xs font-bold uppercase tracking-widest mb-2">Subject Summary:</p>
                  <p className="text-emerald-900 font-medium italic text-lg leading-relaxed">"{problem || 'Analyzed from visual media'}"</p>
                  <p className="mt-4 text-stone-600 text-sm leading-relaxed">{result.introduction}</p>
                </div>
              </div>
            </div>

            {/* 2. Remedies Section */}
            <div className="px-10 space-y-20">
              <div className="space-y-16">
                {result.solutions.map((sol, idx) => {
                  const isSaved = favorites.some(f => f.recipe.title === sol.remedyTitle);
                  return (
                    <section key={idx} className="relative">
                      {/* Section Title */}
                      <div className="flex items-start justify-between mb-8 group">
                        <div className="flex items-center gap-5">
                          <div className="flex-shrink-0 w-14 h-14 bg-emerald-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-emerald-100">
                            {idx + 1}
                          </div>
                          <div>
                            <h3 className="text-3xl font-bold text-stone-900 font-serif">{sol.remedyTitle}</h3>
                            <div className="flex items-center mt-1 text-emerald-600 font-bold text-xs uppercase tracking-[0.2em]">
                              <i className="fas fa-leaf mr-2"></i> Primary Herb: {sol.herbName}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSave(sol)}
                          className={`p-4 rounded-2xl transition-all shadow-sm border no-pdf ${isSaved ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-stone-300 hover:text-emerald-500 bg-white border-stone-200'}`}
                        >
                          <i className={`fas ${isSaved ? 'fa-heart' : 'fa-bookmark'} text-lg`}></i>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Left Column: Practical Usage */}
                        <div className="space-y-8">
                          <p className="text-stone-600 leading-relaxed text-lg font-light border-l-4 border-emerald-200 pl-6 italic">
                            {sol.description}
                          </p>

                          {/* Checklist-style Ingredients */}
                          <div className="space-y-4">
                             <div className="flex items-center gap-3">
                               <i className="fas fa-basket-shopping text-emerald-600"></i>
                               <h4 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">Required Botanicals</h4>
                             </div>
                             <div className="bg-stone-50 rounded-3xl p-6 border border-stone-100/80 space-y-3">
                                {sol.ingredients?.map((ing, iIdx) => (
                                  <label key={iIdx} className="flex items-center gap-4 group cursor-pointer no-pdf">
                                    <div className="relative w-6 h-6 flex-shrink-0">
                                      <input type="checkbox" className="peer appearance-none w-6 h-6 border-2 border-stone-200 rounded-lg checked:bg-emerald-600 checked:border-emerald-600 transition-all cursor-pointer" />
                                      <i className="fas fa-check absolute inset-0 flex items-center justify-center text-white text-[10px] opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                                    </div>
                                    <span className="text-sm text-stone-700 font-medium group-hover:text-emerald-700 transition-colors">{ing}</span>
                                  </label>
                                ))}
                                {/* Static PDF Checklist */}
                                <div className="hidden pdf-only space-y-3">
                                   {sol.ingredients?.map((ing, iIdx) => (
                                     <div key={iIdx} className="flex items-center gap-4 text-sm text-stone-700 font-medium">
                                       <div className="w-5 h-5 border-2 border-emerald-100 rounded-md"></div>
                                       {ing}
                                     </div>
                                   ))}
                                </div>
                             </div>
                          </div>

                          {/* Numbered Step Cards */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                               <i className="fas fa-wand-magic-sparkles text-emerald-600"></i>
                               <h4 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">Preparation Ritual</h4>
                             </div>
                             <ol className="space-y-4">
                                {sol.preparationSteps?.map((step, sIdx) => (
                                  <li key={sIdx} className="flex items-stretch bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden group hover:border-emerald-200 transition-all">
                                    <div className="w-14 bg-emerald-50 flex flex-col items-center justify-center font-black text-emerald-800 text-lg group-hover:bg-emerald-100 transition-colors">
                                      {sIdx + 1}
                                    </div>
                                    <div className="flex-1 p-5 flex items-start gap-4">
                                      <i className="fas fa-mortar-pestle text-emerald-600/30 text-xl mt-1"></i>
                                      <p className="text-sm text-stone-700 leading-relaxed font-medium">{step}</p>
                                    </div>
                                  </li>
                                ))}
                             </ol>
                          </div>
                        </div>

                        {/* Right Column: Science & Safety */}
                        <div className="space-y-6">
                           <div className="bg-emerald-900 p-8 rounded-[2rem] text-emerald-50 shadow-xl relative overflow-hidden group">
                              <i className="fas fa-microscope absolute -top-4 -right-4 text-white/5 text-8xl group-hover:scale-125 transition-transform duration-700"></i>
                              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 flex items-center">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></span>
                                Scientific Rationale
                              </h4>
                              <p className="text-sm leading-relaxed opacity-90 font-light">{sol.whyItWorks}</p>
                           </div>

                           <div className="bg-amber-50/50 p-8 rounded-[2rem] border border-amber-100 relative overflow-hidden group">
                              <i className="fas fa-shield-halved absolute -top-4 -right-4 text-amber-200/20 text-8xl group-hover:scale-125 transition-transform duration-700"></i>
                              <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-[0.3em] mb-4 flex items-center">
                                <span className="w-2 h-2 bg-amber-400 rounded-full mr-3"></span>
                                Safety & Contraindications
                              </h4>
                              <p className="text-sm text-amber-900/80 leading-relaxed italic font-medium">{sol.safetyWarning}</p>
                           </div>
                           
                           <div className="p-8 bg-stone-50 rounded-[2rem] border border-stone-100 flex items-center justify-center">
                              <div className="text-center space-y-3">
                                 <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                                    <i className="fas fa-seedling text-emerald-500 text-2xl"></i>
                                 </div>
                                 <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Nourished by Nature</p>
                              </div>
                           </div>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>

              {/* 3. Holistic Guidance Section */}
              <div className="bg-stone-900 p-12 rounded-[3rem] text-stone-300 relative overflow-hidden shadow-2xl">
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-stone-900">
                      <i className="fas fa-spa text-2xl"></i>
                    </div>
                    <h4 className="text-2xl font-bold text-white font-serif">Lifestyle & Holistic Wisdom</h4>
                  </div>
                  <p className="text-lg leading-relaxed text-stone-400 font-light">{result.generalAdvice}</p>
                  
                  <div className="mt-12 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-[10px] text-stone-500 uppercase font-black tracking-[0.5em]">
                      Official Botanical Report • HerbalistAI Digital Archive
                    </div>
                    <div className="flex gap-8 text-stone-600">
                      <i className="fab fa-envira text-2xl hover:text-emerald-500 transition-colors"></i>
                      <i className="fas fa-hands-holding-leaf text-2xl hover:text-emerald-500 transition-colors"></i>
                      <i className="fas fa-dna text-2xl hover:text-emerald-500 transition-colors"></i>
                    </div>
                  </div>
                </div>
                <i className="fas fa-leaf absolute -bottom-24 -left-24 text-white/5 text-[25rem] -rotate-12 pointer-events-none"></i>
              </div>

              {/* 4. Chat Clarifications Section */}
              <div className="pt-20 pb-12 space-y-8">
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-bold text-stone-900 font-serif">Clarification Transcript</h3>
                  <p className="text-stone-500 text-sm">Follow-up inquiries and detailed botanical responses.</p>
                </div>

                <div className="space-y-6">
                  {chatHistory.length > 0 ? (
                    chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-6 rounded-[2rem] text-sm leading-relaxed shadow-sm ${
                          msg.role === 'user' 
                          ? 'bg-emerald-600 text-white rounded-tr-none' 
                          : 'bg-stone-50 text-stone-800 rounded-tl-none border border-stone-200'
                        }`}>
                          <div className={`text-[9px] uppercase font-black tracking-widest mb-2 opacity-60 ${msg.role === 'user' ? 'text-emerald-100' : 'text-stone-500'}`}>
                            {msg.role === 'user' ? 'Inquiry' : 'Professional Advice'}
                          </div>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 no-pdf">
                      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                         <i className="far fa-comment-dots text-stone-300 text-xl"></i>
                      </div>
                      <p className="text-stone-400 text-sm italic font-medium">Ask a question below to start the transcript.</p>
                    </div>
                  )}

                  {followUpLoading && (
                    <div className="flex justify-start no-pdf">
                      <div className="bg-stone-50 p-6 rounded-[2rem] border border-stone-100 flex gap-1.5 items-center">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Form - Excluded from PDF */}
                <form onSubmit={handleFollowUp} className="flex gap-3 no-pdf mt-6">
                  <input
                    type="text"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder="Ask about age limits, storage, or flavor profiles..."
                    className="flex-1 px-6 py-4 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={followUpLoading || !followUp.trim()}
                    className="px-8 py-4 bg-emerald-900 text-white rounded-2xl hover:bg-black transition-all disabled:opacity-50 shadow-xl flex items-center justify-center"
                  >
                    <i className="fas fa-paper-plane"></i>
                  </button>
                </form>
              </div>

              {/* PDF Footer Mark */}
              <div className="hidden pdf-only text-center border-t border-stone-100 pt-8 pb-10">
                 <p className="text-[10px] font-black text-stone-300 uppercase tracking-[0.5em]">Digital Signature: HerbalistAI Authentication • End of Report</p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemedyAdvisor;
