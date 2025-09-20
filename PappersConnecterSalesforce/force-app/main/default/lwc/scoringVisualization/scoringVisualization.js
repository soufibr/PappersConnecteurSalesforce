import { LightningElement, track, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { CurrentPageReference } from 'lightning/navigation';
// Define the fields to fetch
const FIELDS = [
    'Account.Scoring_Financier_Note__c',
    'Account.Scoring_Financier_Score__c'
];
export default class ScoringVisualization extends LightningElement {
    @track recordId; // Automatically set when LWC is on a Record Page
    scoringNote;
    scoringScore;
    // Extract the recordId using CurrentPageReference
    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        if (pageRef && pageRef.attributes) {
            this.recordId = pageRef.attributes.recordId;
            console.log('Extracted recordId:', this.recordId);
        }
    }

    // Fetch fields from the Account using `getRecord`
    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    wiredAccount({ error, data }) {
        if (data) {
            console.log('Account data retrieved:', data);
            this.scoringNote = data.fields.Scoring_Financier_Note__c.value || 'N/A';
            this.scoringScore = data.fields.Scoring_Financier_Score__c.value || 0;
            this.updateProgressRing();
        } else if (error) {
            console.error('Error retrieving account data:', error);
        }
    }
    renderedCallback() {
        //this.extractRecordIdFromUrl();
        this.updateProgressRing();
    }

    // Function to update the progress ring
    updateProgressRing() {
        const circle = this.template.querySelector('.progress-ring__circle');
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;

        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = circumference;

        const offset =
            circumference - (this.scoringScore / 20) * circumference; // Assuming score out of 20
        circle.style.strokeDashoffset = offset;

        // Dynamically set circle color based on scoringScore
        const color = this.getDynamicColor(this.scoringScore);
        circle.style.stroke = color;
    }

    // Function to determine color dynamically based on score
    getDynamicColor(score) {
        if (score >= 16) {
            return '#4caf50'; // Green for high scores
        } else if (score >= 10) {
            return '#ffc107'; // Yellow for medium scores
        } else {
            return '#f44336'; // Red for low scores
        }
    }
}