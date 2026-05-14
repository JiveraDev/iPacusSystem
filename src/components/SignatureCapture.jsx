import { SignatureMaker } from "@docuseal/signature-maker-react";

const SignatureCapture = ({ onSignatureChange, signature, disabled = false }) => {
    const handleSave = (payload) => {
        // Docuseal might return an object or a string depending on version/mode
        let base64 = typeof payload === 'string' ? payload : (payload?.data || payload?.base64);
        
        console.log("--- Signature Debug ---");
        console.log("Payload type:", typeof payload);
        console.log("Extracted prefix:", base64?.substring(0, 30));
        console.log("Data length:", base64?.length);
        
        if (!base64) {
            console.error("No signature data received");
            return;
        }

        // If it's raw base64 (common with some versions of Docuseal), prepend the prefix
        // PNG base64 typically starts with 'iVBOR'
        if (base64.startsWith('iVBOR') || !base64.startsWith('data:image')) {
            console.log("Prepending data URL prefix to raw base64");
            base64 = `data:image/png;base64,${base64}`;
        }
        
        onSignatureChange(base64);
    };

    const handleClear = () => {
        if (disabled) return;
        onSignatureChange(null);
    };

    return (
        <div className="space-y-3 w-full">
            <div className={`border-2 border-dashed rounded-xl overflow-hidden relative min-h-[220px] flex items-center justify-center transition-all bg-white ${
                disabled && !signature ? "bg-gray-100 border-gray-300" : "border-gray-200"
            }`}>
                
                {/* 
                  IMPORTANT: We keep the SignatureMaker in the DOM at all times.
                  This prevents the 'unobserve' on 'IntersectionObserver' errors 
                  caused by the library when the component is unmounted while active.
                */}
                <div className="w-full h-full p-2 relative flex items-center justify-center">
                    
                    {/* Locked State Overlay */}
                    {disabled && !signature && (
                        <div className="absolute inset-0 z-20 bg-gray-100/90 backdrop-blur-[1px] flex flex-col items-center justify-center text-gray-500 p-4 text-center select-none cursor-not-allowed">
                            <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-200 flex flex-col items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-amber-500"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                <p className="text-sm font-bold text-gray-800">Signature Locked</p>
                                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-tight font-semibold">Please agree to terms above first</p>
                            </div>
                        </div>
                    )}

                    {/* Signature Maker (Hidden but still in DOM when signature exists) */}
                    <div className={`w-full h-full min-h-[180px] transition-all duration-300 ${
                        signature ? "absolute opacity-0 pointer-events-none scale-95" : (disabled ? "pointer-events-none grayscale opacity-30" : "opacity-100")
                    }`}>
                        <SignatureMaker
                            onSave={handleSave}
                            allowedModes={["draw", "type"]}
                            color="black"
                            placeholder="Sign here"
                            className="docuseal-signature-maker"
                        />
                    </div>

                    {/* Signature Preview Layer (Always overlayed when signature exists) */}
                    {signature && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-white animate-in fade-in zoom-in-95 duration-500">
                            <div className="relative group bg-gray-50/80 p-6 rounded-xl border border-dashed border-gray-300 w-full flex items-center justify-center min-h-[140px]">
                                <img 
                                    src={signature} 
                                    alt="Your Signature" 
                                    className="max-w-full max-h-[120px] object-contain drop-shadow-md" 
                                    onLoad={() => console.log("Preview image loaded")}
                                    onError={(e) => {
                                        console.error("Preview image failed to load");
                                        // If image fails, clear it so user can try again
                                        // onSignatureChange(null);
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    disabled={disabled}
                                    className={`absolute -top-3 -right-3 p-2.5 rounded-full transition-all shadow-lg border ${
                                        disabled 
                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
                                        : "bg-white text-red-500 hover:bg-red-50 border-red-100 hover:scale-110 active:scale-95"
                                    }`}
                                    title="Redraw signature"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H5c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                </button>
                            </div>
                            <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Verified Digital Signature</p>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Legend / Status Text */}
            {!signature && (
                <div className="flex flex-col items-center gap-1">
                    <p className={`text-[10px] text-center font-medium ${disabled ? "text-gray-400" : "text-gray-500"}`}>
                        {disabled ? "Waiting for consent checkboxes..." : "Draw with mouse/touch or type your name"}
                    </p>
                    <div className="flex gap-2">
                        <span className={`w-2 h-2 rounded-full ${disabled ? "bg-gray-300" : "bg-black animate-pulse"}`}></span>
                        <span className={`text-[10px] uppercase tracking-wider font-bold ${disabled ? "text-gray-400" : "text-gray-600"}`}>
                            {disabled ? "Ink Disabled" : "Standard Black Ink"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SignatureCapture;
