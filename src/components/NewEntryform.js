// src/components/NewEntryForm.js
import React, { useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';

function NewEntryForm() {
    const [currentStage, setCurrentStage] = useState(1);
    const [formData, setFormData] = useState({
        billingDate: '',
        tokenNo: '',
        itemName: '',
        name: '',
        vehicleNo: '',
        grossWt: '',
        tareWt: '',
        rate: '',
        amountPaid: '',
    });
    const [entryId, setEntryId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNextStage = async (e) => {
        e.preventDefault(); // Prevents the browser from reloading the page
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (currentStage === 1) {
                // Stage 1: Initial Entry
                const newDocRef = await addDoc(collection(db, "cottonEntries"), {
                    billingDate: formData.billingDate,
                    tokenNo: formData.tokenNo,
                    itemName: formData.itemName,
                    name: formData.name, // Added 'Name' from your requirements
                    vehicleNo: formData.vehicleNo,
                    grossWt: parseFloat(formData.grossWt), // Ensure numbers are stored as numbers
                    tareWt: null, rate: null, amountPaid: null, // Initialize
                    netWt: null, netWtAfterDeduction: null, deductionHamali: null,
                    weighmentCharges: null, grossAmount: null, lessDeduction: null,
                    netAmount: null, toBePaidAmount: null,
                    status: "Stage1Complete", // Track progress
                    createdAt: new Date(), // Timestamp for ordering
                });
                setEntryId(newDocRef.id); // Store the ID for future updates to this entry
                setCurrentStage(2);
                setSuccessMessage("Stage 1 completed. Proceeding to Stage 2.");

            } else if (currentStage === 2) {
                // Stage 2: Tare Weight
                const grossWt = parseFloat(formData.grossWt); // Get grossWt from current formData
                const tareWt = parseFloat(formData.tareWt);
                const netWt = grossWt - tareWt;

                await updateDoc(doc(db, "cottonEntries", entryId), {
                    tareWt: tareWt,
                    netWt: netWt,
                    status: "Stage2Complete",
                });
                setCurrentStage(3);
                setSuccessMessage("Stage 2 completed. Proceeding to Stage 3.");

            } else if (currentStage === 3) {
                // Stage 3: Rate
                const entryDoc = await getDoc(doc(db, "cottonEntries", entryId));
                const currentEntryData = entryDoc.data();
                const netWt = currentEntryData.netWt; // Use netWt calculated in previous stage
                const rate = parseFloat(formData.rate);

                const netWtAfterDeduction = netWt * 0.986;
                const deductionHamali = netWt * 15; // As per your logic, 15 units per Net Wt
                const grossAmount = netWtAfterDeduction * rate;

                await updateDoc(doc(db, "cottonEntries", entryId), {
                    rate: rate,
                    netWtAfterDeduction: netWtAfterDeduction,
                    deductionHamali: deductionHamali,
                    grossAmount: grossAmount,
                    status: "Stage3Complete",
                });
                setCurrentStage(4);
                setSuccessMessage("Stage 3 completed. Proceeding to Stage 4.");

            } else if (currentStage === 4) {
                // Stage 4: Amount Paid - Final Save
                const entryDoc = await getDoc(doc(db, "cottonEntries", entryId));
                const currentEntryData = entryDoc.data();

                const grossAmount = currentEntryData.grossAmount;
                const deductionHamali = currentEntryData.deductionHamali;
                const amountPaid = parseFloat(formData.amountPaid);

                const weighmentCharges = 50;
                const lessDeduction = deductionHamali + weighmentCharges;
                const netAmount = grossAmount - lessDeduction; // Re-calculate based on full logic
                const toBePaidAmount = netAmount - amountPaid;

                await updateDoc(doc(db, "cottonEntries", entryId), {
                    amountPaid: amountPaid,
                    weighmentCharges: weighmentCharges,
                    lessDeduction: lessDeduction,
                    netAmount: netAmount, // Update this with the fully calculated one
                    toBePaidAmount: toBePaidAmount,
                    status: "Complete",
                    completedAt: new Date(), // Timestamp for completion
                });
                setSuccessMessage("Entry saved successfully! You can start a new entry.");
                // Reset form for new entry after successful save
                setFormData({
                    billingDate: '', tokenNo: '', itemName: '', name: '', vehicleNo: '',
                    grossWt: '', tareWt: '', rate: '', amountPaid: '',
                });
                setEntryId(null); // Clear entry ID for new entry
                setCurrentStage(1); // Go back to start for a new entry
            }

        } catch (e) {
            console.error("Error during stage completion:", e);
            setError("Failed to save data. Please try again. " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const renderStageForm = () => {
        switch (currentStage) {
            case 1:
                return (
                    <>
                        <div className="form-group">
                            <label htmlFor="billingDate">Billing Date:</label>
                            <input type="date" id="billingDate" name="billingDate" value={formData.billingDate} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="tokenNo">Token No.:</label>
                            <input type="text" id="tokenNo" name="tokenNo" value={formData.tokenNo} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="itemName">Item Name:</label>
                            <input type="text" id="itemName" name="itemName" value={formData.itemName} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="name">Name:</label>
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="vehicleNo">Vehicle No.:</label>
                            <input type="text" id="vehicleNo" name="vehicleNo" value={formData.vehicleNo} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="grossWt">Gross Wt:</label>
                        <input type="number" id="grossWt" name="grossWt" value={formData.grossWt} onChange={handleChange} required step="0.01" />
                        </div>
                        <button type="submit" className="submit-button" disabled={loading}>
                            {loading ? 'Saving...' : 'Next: Enter Tare Weight'}
                        </button>
                    </>
                );
            case 2:
                return (
                    <>
                        <p>Current Entry ID: {entryId}</p> {/* Show ID for debugging/reference */}
                        <div className="form-group">
                            <label htmlFor="tareWt">Tare Wt:</label>
                        <input type="number" id="tareWt" name="tareWt" value={formData.tareWt} onChange={handleChange} required step="0.01" />
                        </div>
                        <button type="submit" className="submit-button" disabled={loading}>
                            {loading ? 'Saving...' : 'Next: Enter Rate'}
                        </button>
                    </>
                );
            case 3:
                return (
                    <>
                        <p>Current Entry ID: {entryId}</p>
                        <div className="form-group">
                            <label htmlFor="rate">Rate:</label>
                        <input type="number" id="rate" name="rate" value={formData.rate} onChange={handleChange} required step="0.01" />
                        </div>
                        <button type="submit" className="submit-button" disabled={loading}>
                            {loading ? 'Saving...' : 'Next: Enter Amount Paid'}
                        </button>
                    </>
                );
            case 4:
                return (
                    <>
                        <p>Current Entry ID: {entryId}</p>
                        <div className="form-group">
                            <label htmlFor="amountPaid">Amount Paid:</label>
                        <input type="number" id="amountPaid" name="amountPaid" value={formData.amountPaid} onChange={handleChange} required step="0.01" />
                        </div>
                        <button type="submit" className="submit-button" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Final Entry'}
                        </button>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <div className="new-entry-container">
            <h2>New Cotton Entry</h2>
            <div className="stage-indicator">
                <div className={`stage-circle ${currentStage === 1 ? 'active' : ''}`}>1</div>
                <div className={`stage-circle ${currentStage === 2 ? 'active' : ''}`}>2</div>
                <div className={`stage-circle ${currentStage === 3 ? 'active' : ''}`}>3</div>
                <div className={`stage-circle ${currentStage === 4 ? 'active' : ''}`}>4</div>
            </div>
            {successMessage && <p className="success-message">{successMessage}</p>}
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleNextStage} className="form-container">
                {renderStageForm()}
            </form>
        </div>
    );
}

export default NewEntryForm;