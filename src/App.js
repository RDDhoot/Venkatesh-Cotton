import React, { useState, useEffect } from 'react';
import './App.css';
import { db } from './firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, getDocs, doc, getDoc, updateDoc, where, setDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';

// PDF generation imports
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function App() {
    // --- State for current entry being worked on ---
    const [currentEntryId, setCurrentEntryId] = useState(null); // Firestore Document ID (now Token No.)
    const [searchToken, setSearchToken] = useState(''); // For looking up an entry by token
    const [isNewEntry, setIsNewEntry] = useState(false); // Flag if we're creating new or editing existing

    // --- States for form inputs ---
    const [billingDate, setBillingDate] = useState('');
    const [tokenNo, setTokenNo] = useState('');
    const [itemName, setItemName] = useState('');
    const [Name, setName] = useState('');    
    const [Village, setVillage] = useState('');    
    const [vehicleNo, setVehicleNo] = useState('');
    const [grossWt, setGrossWt] = useState('');
    const [tareWt, setTareWt] = useState('');
    const [rate, setRate] = useState('');
    // Removed amountPaid state

    // --- State for recent entries table ---
    const [recentEntries, setRecentEntries] = useState([]);

    // --- useEffect for Real-time Data Fetching ---
    useEffect(() => {
        const q = query(collection(db, 'cottonEntries'), orderBy('timestamp', 'desc'), limit(20));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entriesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRecentEntries(entriesData);
        }, (error) => {
            console.error("Error fetching real-time data: ", error);
        });
        return () => unsubscribe();
    }, []);

    // --- Reset Form Function ---
    const resetForm = () => {
        setCurrentEntryId(null);
        setSearchToken('');
        setIsNewEntry(false);
        setBillingDate('');
        setTokenNo('');
        setItemName('');
        setName('');
        setVillage('');
        setVehicleNo('');
        setGrossWt('');
        setTareWt('');
        setRate('');
        // Removed amountPaid reset
    };

    // --- Handle Lookup Entry by Token ---
    const handleLookupEntry = async () => {
        if (!searchToken) {
            alert('Please enter a Token Number to search.');
            return;
        }

        try {
            const entryRef = doc(db, 'cottonEntries', searchToken);
            const entrySnap = await getDoc(entryRef);

            if (entrySnap.exists()) {
                const entryData = entrySnap.data();

                setCurrentEntryId(searchToken); // Set ID to tokenNo
                setIsNewEntry(false); // We are editing, not creating new
                setBillingDate(entryData.billingDate || '');
                setTokenNo(entryData.tokenNo || '');
                setItemName(entryData.itemName || '');
                setName(entryData.Name || '');
                setVillage(entryData.Village || '');
                setVehicleNo(entryData.vehicleNo || '');
                setGrossWt(entryData.grossWt || '');
                setTareWt(entryData.tareWt || '');
                setRate(entryData.rate || '');
                // Removed amountPaid setting
            } else {
                alert(`No entry found for Token No: ${searchToken}. You can create a new entry with this token.`);
                resetForm();
                setIsNewEntry(true);
                setTokenNo(searchToken); // Pre-fill
            }
        } catch (error) {
            console.error("Error looking up entry: ", error);
            alert('Error looking up entry. Check console for details.');
        }
    };

    // --- Save/Update Entry ---
    const handleSaveOrUpdateEntry = async (e) => {
        e.preventDefault();

        if (!tokenNo) {
            alert('Token Number is required.');
            return;
        }

        // Basic validation for mandatory initial fields if creating new
        if (isNewEntry && (!billingDate || !itemName || !Name || !Village || !vehicleNo || !grossWt)) {
            alert('For a new entry, Billing Date, Item Name,Name,Village, Vehicle No., and Gross Weight are required.');
            return;
        }

        const parsedGrossWt = parseFloat(grossWt || 0);
        const parsedTareWt = parseFloat(tareWt || 0);
        const parsedRate = parseFloat(rate || 0);

        // Calculations
        let netWt = 0;
        let netWtAfterDeduction = 0;
        let hamaliDeduction = 0;
        let grossAmount = 0; // Will be calculated if rate and netWtAfterDeduction are available
        let netAmount = 0; // New calculation

        const weighmentCharges = 50; // Constant for weighment charges

        if (parsedGrossWt && parsedTareWt) {
            netWt = parsedGrossWt - parsedTareWt;
            netWtAfterDeduction = netWt * 0.986;
            hamaliDeduction = netWt * 15;
        }

        if (parsedRate && netWtAfterDeduction) {
            grossAmount = parsedRate * netWtAfterDeduction;
            // Calculate Net Amount: Gross Amount - Hamali - Weighment Charges (50)
            netAmount = grossAmount - hamaliDeduction - weighmentCharges;
        }


        const entryData = {
            billingDate: billingDate || null,
            tokenNo: tokenNo || null,
            itemName: itemName || null,
            Name: Name || null,
            Village: Village || null,
            vehicleNo: vehicleNo || null,
            grossWt: parsedGrossWt || null,
            tareWt: parsedTareWt || null,
            rate: parsedRate || null,
            netWt: parseFloat(netWt.toFixed(2)) || null,
            netWtAfterDeduction: parseFloat(netWtAfterDeduction.toFixed(2)) || null,
            hamaliDeduction: parseFloat(hamaliDeduction.toFixed(2)) || null,
            grossAmount: parseFloat(grossAmount.toFixed(2)) || null, // Storing gross amount
            netAmount: parseFloat(netAmount.toFixed(2)) || null, // Storing net amount
            timestamp: serverTimestamp(),
            lastUpdatedBy: 'Current User' 
        };

        try {
            const entryRef = doc(db, 'cottonEntries', tokenNo);
            if (currentEntryId) {
                await updateDoc(entryRef, entryData);
                alert('Entry updated successfully!');
            } else {
                await setDoc(entryRef, entryData);
                alert('New entry created successfully!');
            }
            resetForm();
        } catch (error) {
            console.error("Error saving/updating entry: ", error);
            alert('Error saving/updating entry. Check console for details.');
        }
    };

    // --- Export to Excel Function (adjusted to new fields) ---
    const exportToExcel = async () => {
        const allEntriesSnapshot = await getDocs(query(collection(db, 'cottonEntries'), orderBy('itemName', 'asc')));
        const allEntries = [];
        allEntriesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                data.timestamp = data.timestamp.toDate().toLocaleDateString();
            }
            allEntries.push(data);
        });

        if (allEntries.length === 0) {
            alert("No entries to export!");
            return;
        }

        const wb = XLSX.utils.book_new();
        const headers = [
            "Billing Date", "Token No.", "Item Name","Name","Village", "Vehicle No.", "Gross Wt", "Tare Wt",
            "Net Wt", "Net Wt (Ded.)", "Hamali", "Rate", "Gross Amount", "Net Amount" // Added Net Amount
        ];

        const summaryData = allEntries.map(entry => [
            entry.billingDate, entry.tokenNo, entry.itemName,entry.Name,entry.Village, entry.vehicleNo,
            entry.grossWt, (entry.tareWt !== null ? entry.tareWt : ''),
            entry.netWt, entry.netWtAfterDeduction, (entry.hamaliDeduction !== null ? entry.hamaliDeduction : ''),
            entry.rate, (entry.rate && entry.netWtAfterDeduction ? (entry.rate * entry.netWtAfterDeduction).toFixed(2) : ''), // Gross Amount
            (entry.grossAmount !== null && entry.hamaliDeduction !== null ? (entry.grossAmount - entry.hamaliDeduction - 50).toFixed(2) : '') // Net Amount calculation for export
        ]);
        const summaryWs = XLSX.utils.aoa_to_sheet([headers, ...summaryData]);
        XLSX.utils.book_append_sheet(wb, summaryWs, "All Entries Summary");

        const groupedByItem = allEntries.reduce((acc, entry) => {
            const itemName = entry.itemName || "Unknown Item";
            if (!acc[itemName]) {
                acc[itemName] = [];
            }
            acc[itemName].push(entry);
            return acc;
        }, {});

        for (const itemName in groupedByItem) {
            const itemEntries = groupedByItem[itemName];
            const sheetData = itemEntries.map(entry => [
                entry.billingDate, entry.tokenNo, entry.itemName,entry.Name,entry.Village, entry.vehicleNo,
                entry.grossWt, (entry.tareWt !== null ? entry.tareWt : ''),
                entry.netWt, entry.netWtAfterDeduction, (entry.hamaliDeduction !== null ? entry.hamaliDeduction : ''),
                entry.rate, (entry.rate && entry.netWtAfterDeduction ? (entry.rate * entry.netWtAfterDeduction).toFixed(2) : ''), // Gross Amount
                (entry.grossAmount !== null && entry.hamaliDeduction !== null ? (entry.grossAmount - entry.hamaliDeduction - 50).toFixed(2) : '') // Net Amount calculation for export
            ]);
            const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
            const safeItemName = itemName.replace(/[\\/?*[\]:; ]/g, '_').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, safeItemName);
        }
        XLSX.writeFile(wb, "VCC_Cotton_Entries.xlsx");
        alert('Export initiated. Check your downloads.');
    };

    // --- PDF Generation Function (now accepts entry data) ---
    const generatePdf = async (entryToPrint) => {
        if (!entryToPrint || !entryToPrint.tokenNo) {
            alert('Cannot generate PDF: invalid entry data.');
            return;
        }

        // Calculations for PDF display
        const parsedGrossWt = parseFloat(entryToPrint.grossWt || 0);
        const parsedTareWt = parseFloat(entryToPrint.tareWt || 0);
        const parsedRate = parseFloat(entryToPrint.rate || 0);

        let netWt = parsedGrossWt && parsedTareWt ? parsedGrossWt - parsedTareWt : 0;
        let netWtAfterDeduction = netWt * 0.986;
        let hamaliDeduction = netWt * 15;
        const weighmentCharges = 50;

        let grossAmount = parsedRate && netWtAfterDeduction ? parsedRate * netWtAfterDeduction : 0;
        let netAmount = grossAmount - hamaliDeduction - weighmentCharges;

        // Create a temporary element to render the PDF content
        const pdfContentElement = document.createElement('div');
        pdfContentElement.style.width = '210mm'; // A4 width
        pdfContentElement.style.padding = '10mm';
        pdfContentElement.style.boxSizing = 'border-box';
        pdfContentElement.innerHTML = `
            <style>
                .pdf-bill-container {
                    font-family: Arial, sans-serif;
                    border: 1px solid #000;
                    padding: 10px;
                    margin-bottom: 20px;
                }
                .pdf-header {
                    text-align: center;
                    font-weight: bold;
                    margin-bottom: 15px;
                }
                .pdf-row {
                    display: flex;
                    margin-bottom: 5px;
                }
                .pdf-col-left {
                    width: 30%;
                    font-weight: bold;
                }
                .pdf-col-right {
                    width: 70%;
                }
                .pdf-field-box {
                    border: 1px solid #000;
                    padding: 2px 5px;
                    min-height: 20px;
                    display: flex;
                    align-items: center;
                    box-sizing: border-box; /* Ensure padding is inside the width */
                }
                .pdf-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-top: 10px;
                }
                .pdf-grid-item {
                    display: flex;
                    flex-direction: column;
                }
                .pdf-sub-header {
                    font-weight: bold;
                    margin-top: 10px;
                    margin-bottom: 5px;
                }
                .pdf-full-width-box {
                    border: 1px solid #000;
                    padding: 5px;
                    margin-top: 5px;
                    min-height: 30px;
                    display: flex;
                    align-items: center;
                    box-sizing: border-box; /* Ensure padding is inside the width */
                }
                .align-right {
                    text-align: right;
                }
                /* Specific styles to match the image more closely */
                .pdf-field-line {
                    display: flex;
                    align-items: center;
                    margin-bottom: 5px;
                }
                .pdf-field-label {
                    font-weight: bold;
                    margin-right: 5px;
                    white-space: nowrap; /* Prevent label from wrapping */
                }
                .pdf-section-spacing {
                    margin-top: 15px;
                }
                .pdf-grid-half-width {
                    width: calc(50% - 5px); /* Adjusted for gap */
                }
                .pdf-grid-full-width {
                    width: 100%;
                }
                .pdf-small-box {
                    width: 80px; /* Specific width for apmc copy */
                    text-align: center;
                    font-size: 0.8em;
                }
                .pdf-large-field {
                    min-height: 25px;
                }
            </style>
            <div class="pdf-bill-container">
                <div class="pdf-header">FARMER PURCHASE BILL</div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div class="pdf-field-line">
                        <span class="pdf-field-label">Token No. :</span>
                        <div class="pdf-field-box pdf-large-field" style="width: 120px;">${entryToPrint.tokenNo || ''}</div>
                    </div>
                    <div class="pdf-field-line">
                        <span class="pdf-field-label">Date :</span>
                        <div class="pdf-field-box pdf-large-field" style="width: 150px;">${entryToPrint.billingDate || ''}</div>
                    </div>
                    <div class="pdf-field-box pdf-small-box">apmc Copy</div>
                </div>

                <div class="pdf-field-line pdf-section-spacing">
                    <span class="pdf-field-label">Farmer Name:</span>
                    <div class="pdf-full-width-box pdf-large-field" style="flex-grow: 1;">${entryToPrint.Name || ''}</div>
                </div>

                <div class="pdf-grid pdf-section-spacing">
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Village:</span>
                        <div class="pdf-field-box pdf-large-field">${entryToPrint.Village || ''}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">gross wt:</span>
                        <div class="pdf-field-box pdf-large-field">${parsedGrossWt.toFixed(2)}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Vehicle No.:</span>
                        <div class="pdf-field-box pdf-large-field">${entryToPrint.vehicleNo || ''}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Tare Wt:</span>
                        <div class="pdf-field-box pdf-large-field">${parsedTareWt.toFixed(2)}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Rate:</span>
                        <div class="pdf-full-width-box pdf-large-field" style="flex-grow: 1;">${parsedRate.toFixed(2)}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Net Wt:</span>
                        <div class="pdf-field-box pdf-large-field">${netWt.toFixed(2)}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Deductions (Hamali + 50) :</span>
                        <div class="pdf-full-width-box pdf-large-field" style="flex-grow: 1;">${hamaliDeduction.toFixed(2)} + 50</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Net Wt after Deductions:</span>
                        <div class="pdf-field-box pdf-large-field">(Net wt * 0.986) ${netWtAfterDeduction.toFixed(2)}</div>
                    </div>
                    <div class="pdf-grid-item" style="grid-column: 2 / 3;">
                        <span class="pdf-field-label">Net Amount:</span>
                        <div class="pdf-full-width-box pdf-large-field" style="font-size: 1.2em; text-align: right; flex-grow: 1;">${netAmount.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div class="pdf-bill-container" style="margin-top: 20px;">
                <div class="pdf-header">FARMER PURCHASE BILL</div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div class="pdf-field-line">
                        <span class="pdf-field-label">Token No. :</span>
                        <div class="pdf-field-box pdf-large-field" style="width: 120px;">${entryToPrint.tokenNo || ''}</div>
                    </div>
                    <div class="pdf-field-line">
                        <span class="pdf-field-label">Date :</span>
                        <div class="pdf-field-box pdf-large-field" style="width: 150px;">${entryToPrint.billingDate || ''}</div>
                    </div>
                    <div class="pdf-field-box pdf-small-box">FarmerCopy</div>
                </div>

                <div class="pdf-field-line pdf-section-spacing">
                    <span class="pdf-field-label">Farmer Name:</span>
                    <div class="pdf-full-width-box pdf-large-field" style="flex-grow: 1;">${entryToPrint.Name || ''}</div>
                </div>

                <div class="pdf-grid pdf-section-spacing">
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Village:</span>
                        <div class="pdf-field-box pdf-large-field">${entryToPrint.Village || ''}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">gross wt:</span>
                        <div class="pdf-field-box pdf-large-field">${parsedGrossWt.toFixed(2)}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Vehicle No.:</span>
                        <div class="pdf-field-box pdf-large-field">${entryToPrint.vehicleNo || ''}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Tare Wt:</span>
                        <div class="pdf-field-box pdf-large-field">${parsedTareWt.toFixed(2)}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Rate:</span>
                        <div class="pdf-full-width-box pdf-large-field" style="flex-grow: 1;">${parsedRate.toFixed(2)}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Net Wt:</span>
                        <div class="pdf-field-box pdf-large-field">${netWt.toFixed(2)}</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Deductions (Hamali + 50) :</span>
                        <div class="pdf-full-width-box pdf-large-field" style="flex-grow: 1;">${hamaliDeduction.toFixed(2)} + 50</div>
                    </div>
                    <div class="pdf-grid-item">
                        <span class="pdf-field-label">Net Wt after Deductions:</span>
                        <div class="pdf-field-box pdf-large-field">(Net wt * 0.986) ${netWtAfterDeduction.toFixed(2)}</div>
                    </div>
                    <div class="pdf-grid-item" style="grid-column: 2 / 3;">
                        <span class="pdf-field-label">Net Amount:</span>
                        <div class="pdf-full-width-box pdf-large-field" style="font-size: 1.2em; text-align: right; flex-grow: 1;">${netAmount.toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(pdfContentElement); // Temporarily append to body for html2canvas

        try {
            const canvas = await html2canvas(pdfContentElement, {
                scale: 2, // Increase scale for better resolution
                useCORS: true, // Important if you have images from different origins
                windowWidth: pdfContentElement.scrollWidth,
                windowHeight: pdfContentElement.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' for A4 size

            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`Farmer_Purchase_Bill_${entryToPrint.tokenNo}.pdf`);
            alert('PDF generated successfully!');
        } catch (error) {
            console.error("Error generating PDF: ", error);
            alert('Failed to generate PDF. Check console for details.');
        } finally {
            document.body.removeChild(pdfContentElement); // Clean up the temporary element
        }
    };


    // Determine if tareWt is present (meaning Stage 2+ data exists)
    const hasTareWtBeenEntered = tareWt !== '' && tareWt !== null && parseFloat(tareWt) > 0;

    return (
        <div className="container">
            <h1>VCC Cotton Entry</h1>

            <div className="entry-form-section">
                {!currentEntryId && !isNewEntry ? (
                    // --- Initial State: Ask for Token or Create New ---
                    <div>
                        <h2>Find or Create Entry</h2>
                        <label htmlFor="searchToken">Enter Token No. to Load/Create:</label>
                        <input
                            type="text"
                            id="searchToken"
                            value={searchToken}
                            onChange={(e) => setSearchToken(e.target.value)}
                            placeholder="e.g., C001"
                        />
                        <button onClick={handleLookupEntry}>Load/Create Entry</button>
                        <button onClick={resetForm}>Clear Form</button>
                    </div>
                ) : (
                    // --- Form is Active for New/Edit ---
                    <div>
                        <h2>{isNewEntry ? `New Entry: Token ${tokenNo}` : `Editing Entry: Token ${tokenNo}`}</h2>
                        <form onSubmit={handleSaveOrUpdateEntry}>
                            {/* Billing Date (Stage 1) */}
                            <label htmlFor="billingDate">Billing Date:</label>
                            <input type="date" id="billingDate" value={billingDate} onChange={(e) => setBillingDate(e.target.value)} required={isNewEntry} disabled={hasTareWtBeenEntered && !isNewEntry} />

                            {/* Token No. (Stage 1) */}
                            <label htmlFor="tokenNo">Token No.:</label>
                            <input type="text" id="tokenNo" value={tokenNo} readOnly disabled={!isNewEntry && !hasTareWtBeenEntered} required /> {/* Read-only always, disabled if not new and tare entered */}

                            {/* Item Name (Stage 1) */}
                            <label htmlFor="itemName">Item Name:</label>
                            <input type="text" id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} required={isNewEntry} disabled={hasTareWtBeenEntered && !isNewEntry} />
                            
                            <label htmlFor="Name">Name:</label>
                            <input type="text" id="Name" value={Name} onChange={(e) => setName(e.target.value)} required={isNewEntry} disabled={hasTareWtBeenEntered && !isNewEntry} />
                            
                            <label htmlFor="Village">Village:</label>
                            <input type="text" id="Village" value={Village} onChange={(e) => setVillage(e.target.value)} required={isNewEntry} disabled={hasTareWtBeenEntered && !isNewEntry} />
                            
                            {/* Vehicle No. (Stage 1) */}
                            <label htmlFor="vehicleNo">Vehicle No.:</label>
                            <input type="text" id="vehicleNo" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} required={isNewEntry} disabled={hasTareWtBeenEntered && !isNewEntry} />

                            {/* Gross Weight (Stage 1) */}
                            <label htmlFor="grossWt">Gross Weight (kg):</label>
                            <input type="number" id="grossWt" step="0.01" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} required={isNewEntry} disabled={hasTareWtBeenEntered && !isNewEntry} />

                            {/* Tare Weight (Stage 2) */}
                            <label htmlFor="tareWt">Tare Weight (kg):</label>
                            <input type="number" id="tareWt" step="0.01" value={tareWt} onChange={(e) => setTareWt(e.target.value)}  /> {/* Disable if not new and tareWt already exists and is valid */}

                            {/* Rate (Stage 3) - Always editable if the form is open */}
                            <label htmlFor="rate">Rate:</label>
                            <input type="number" id="rate" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />

                            {/* Removed Amount Paid Field */}

                            <button type="submit">Save/Update Entry</button>
                            <button type="button" onClick={resetForm}>Cancel/New Search</button>
                            {/* The PDF button here is removed as it's now per-entry in the table */}
                        </form>
                    </div>
                )}
            </div>

            <hr />

            <h2>Recent Entries</h2>
            <div className="table-container">
                <table id="recentEntriesTable">
                    <thead>
                        <tr>
                            <th>Billing Date</th>
                            <th>Token No.</th>
                            <th>Item Name</th>
                            <th>Name</th>
                            <th>Village</th>
                            <th>Vehicle No.</th>
                            <th>Gross Wt</th>
                            <th>Tare Wt</th>
                            <th>Net Wt</th>
                            <th>Net Wt (Ded.)</th>
                            <th>Hamali</th> 
                            <th>Rate</th>
                            <th>Gross Amount</th>
                            <th>Net Amount</th>
                            <th>Actions</th> {/* Added new header for the PDF button */}
                        </tr>
                    </thead>
                    <tbody>
                        {recentEntries.map(entry => {
                            // Recalculate Gross Amount and Net Amount for display
                            const currentGrossAmount = entry.rate && entry.netWtAfterDeduction ? (entry.rate * entry.netWtAfterDeduction) : 0;
                            const currentHamali = entry.hamaliDeduction || 0;
                            const currentNetAmount = currentGrossAmount > 0 ? (currentGrossAmount - currentHamali - 50) : 0; // - 50 for weighment charges

                            return (
                                <tr key={entry.id}>
                                    <td>{entry.billingDate || 'N/A'}</td>
                                    <td>{entry.tokenNo || 'N/A'}</td>
                                    <td>{entry.itemName || 'N/A'}</td>
                                    <td>{entry.Name || 'N/A'}</td>
                                    <td>{entry.Village || 'N/A'}</td>
                                    <td>{entry.vehicleNo || 'N/A'}</td>
                                    <td>{entry.grossWt || 'N/A'}</td>
                                    <td>{entry.tareWt || 'N/A'}</td>
                                    <td>{entry.netWt || 'N/A'}</td>
                                    <td>{entry.netWtAfterDeduction ? entry.netWtAfterDeduction.toFixed(2) : 'N/A'}</td>
                                    <td>{entry.hamaliDeduction ? entry.hamaliDeduction.toFixed(2) : 'N/A'}</td>
                                    <td>{entry.rate || 'N/A'}</td>
                                    <td>{currentGrossAmount ? currentGrossAmount.toFixed(2) : 'N/A'}</td>
                                    <td>{currentNetAmount ? currentNetAmount.toFixed(2) : 'N/A'}</td>
                                    <td>
                                        <button 
                                            onClick={() => generatePdf(entry)} // Pass the individual entry to the function
                                            style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '3px' }}
                                        >
                                            Download PDF
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <button type="button" onClick={exportToExcel}>Export All to Excel</button>
        </div>
    );
}

export default App;