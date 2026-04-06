
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const exportToPdf = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Use html2canvas to capture the styled content as an image to preserve font scripts
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight
  });

  const imgData = canvas.toDataURL('image/png');
  const imgProps = {
    width: canvas.width,
    height: canvas.height
  };
  
  const pdfWidth = 210; // A4 width in mm
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

  // Create PDF with dynamic height to ensure all content fits on one continuous page
  // This is better for digital viewing of long reports/recipes
  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: [pdfWidth, pdfHeight]
  });

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`${filename}.pdf`);
};
