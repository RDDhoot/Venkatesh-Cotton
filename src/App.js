import React, { useState, useEffect } from 'react';
import './App.css';
import { db } from './firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, getDocs, doc, getDoc, updateDoc, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';

function App() {
    // --- State for current entry being worked on ---
    const [currentEntryId, setCurrentEntryId] = useState(null); // Firestore Document ID
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
            const q = query(collection(db, 'cottonEntries'), where('tokenNo', '==', searchToken));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert(`No entry found for Token No: ${searchToken}. You can create a new entry with this token.`);
                resetForm();
                setIsNewEntry(true);
                setTokenNo(searchToken); // Pre-fill
                return;
            }

            if (querySnapshot.docs.length > 1) {
                alert('Warning: Multiple entries found for this token. This should not happen. Loading the first one.');
            }

            const entryDoc = querySnapshot.docs[0];
            const entryData = entryDoc.data();

            setCurrentEntryId(entryDoc.id);
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
        // Removed parsedAmountPaid

        // Calculations - ensure all required values are present before calculating
        let netWt = 0, netWtAfterDeduction = 0, hamaliDeduction = 0; // Removed other calculations
        const weighmentCharges = 50; // Still a constant if needed for other places, but not in output

        if (parsedGrossWt && parsedTareWt) { // Only calculate if gross and tare are available
            netWt = parsedGrossWt - parsedTareWt;
            netWtAfterDeduction = netWt * 0.986;
            hamaliDeduction = netWt * 15;
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
            // Removed amountPaid
            netWt: parseFloat(netWt.toFixed(2)) || null,
            netWtAfterDeduction: parseFloat(netWtAfterDeduction.toFixed(2)) || null,
            hamaliDeduction: parseFloat(hamaliDeduction.toFixed(2)) || null,
            // Removed other calculated fields
            timestamp: serverTimestamp(),
            lastUpdatedBy: 'Current User' // You can add user authentication here later
        };

        try {
            if (currentEntryId) {
                // Updating an existing entry
                await updateDoc(doc(db, 'cottonEntries', currentEntryId), entryData);
                alert('Entry updated successfully!');
            } else {
                // Creating a new entry
                await addDoc(collection(db, 'cottonEntries'), entryData);
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
            "Net Wt", "Net Wt (Ded.)", "Hamali" // Added Hamali back as it's a deduction
        ];

        const summaryData = allEntries.map(entry => [
            entry.billingDate, entry.tokenNo, entry.itemName,entry.Name,entry.Village, entry.vehicleNo,
            entry.grossWt, (entry.tareWt !== null ? entry.tareWt : ''),
            entry.netWt, entry.netWtAfterDeduction, (entry.hamaliDeduction !== null ? entry.hamaliDeduction : '')
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
                entry.netWt, entry.netWtAfterDeduction, (entry.hamaliDeduction !== null ? entry.hamaliDeduction : '')
            ]);
            const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
            const safeItemName = itemName.replace(/[\\/?*[\]:; ]/g, '_').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, safeItemName);
        }
        XLSX.writeFile(wb, "VCC_Cotton_Entries.xlsx");
        alert('Export initiated. Check your downloads.');
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
                            <th>Hamali</th> {/* Keeping Hamali in table for derived value visibility */}
                        </tr>
                    </thead>
                    <tbody>
                        {recentEntries.map(entry => (
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
                                <td>{entry.netWtAfterDeduction || 'N/A'}</td>
                                <td>{entry.hamaliDeduction || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button type="button" onClick={exportToExcel}>Export All to Excel</button>
        </div>
    );
}

export default App;