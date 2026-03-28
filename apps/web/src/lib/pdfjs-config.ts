import * as pdfjsLib from 'pdfjs-dist';

// Point to the worker file in the public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
