import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/layout/Header";
import Index from "./pages/Index";
import Create from "./pages/Create";
import Preview from "./pages/Preview";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function Root() {
  // Ensure dark mode and base background class are applied globally
  useEffect(() => {
    document.documentElement.classList.add("dark", "bg-gray-900");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* Header is outside Routes to persist across pages */}
          <Header /> 
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/create" element={<Create />} />
            <Route path="/preview" element={<Preview />} />
            
            {/* Catch-all route for 404 errors */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

// --- Application Mounting ---
const container = document.getElementById("root");

// Ensure the container exists before attempting to render
if (!container) {
    throw new Error("Root element with id 'root' not found in the DOM. Check index.html.");
}

// Render the application
createRoot(container).render(<Root />);
