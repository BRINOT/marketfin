"use client";

import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

interface ExportButtonProps {
  data: any;
  format: "excel" | "pdf";
}

export function ExportButton({ data, format }: ExportButtonProps) {
  const handleExport = () => {
    if (!data) return;

    // TODO: Implement actual export logic
    console.log(`Exporting data as ${format}`, data);
    
    // Placeholder for export functionality
    alert(`Exportação em ${format.toUpperCase()} será implementada em breve.`);
  };

  const icon = format === "excel" ? (
    <FileSpreadsheet className="h-4 w-4 mr-2" />
  ) : (
    <FileText className="h-4 w-4 mr-2" />
  );

  const label = format === "excel" ? "Exportar Excel" : "Exportar PDF";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={!data}
    >
      {icon}
      {label}
    </Button>
  );
}
