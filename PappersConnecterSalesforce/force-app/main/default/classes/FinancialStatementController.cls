public with sharing class FinancialStatementController {
    @AuraEnabled(cacheable=true)
    public static List<Financial_Statement__c> getFinancialStatements(Id accountId) {
        return [SELECT Annee__c, chiffre_affaires__c, Marge_brute__c, EBITDA_EBE__c, Resultat_dexploitation__c, 
                Resultat_net__c, Taux_de_croissance_du_CA__c, Taux_de_marge_brute__c, Taux_de_marge_dEBITDA__c, 
                Taux_de_marge_oprationnelle__c, BFR__c, BFR_exploitation__c, BFR_hors_exploitation__c, BFR_j_de_CA__c, 
                Capacite_dautofinancement__c, Fonds_de_roulement_net_global__c, Trsorerie__c, Dettes_financires__c, 
                Capacit_de_remboursement__c, Ratio_dendettement_Gearing__c, Liquidit_generale__c, 
                Couverture_des_dettes__c, Fonds_propres__c, Marge_nette__c, Rentabilit_sur_fonds_propres__c, 
                Rentabilite_economique__c, Valeur_ajoutee__c, Salaires_et_charges_sociales__c, Salaires_CA__c, 
                Impots_et_taxes__c,Autonomie_financiere__c,tat_des_dettes_1_an_au_plus__c
                FROM Financial_Statement__c 
                WHERE Account__c = :accountId
                ORDER BY Annee__c ASC];
    }
    @AuraEnabled
	public static Boolean updateFinancialStatements(Id accountId, List<Map<String, Object>> financialData) {
    try {
        // Fetch existing financial statements for the account
        List<Financial_Statement__c> existingStatements = [
            SELECT Id, Annee__c 
            FROM Financial_Statement__c 
            WHERE Account__c = :accountId
        ];

        Map<String, Financial_Statement__c> yearToStatementMap = new Map<String, Financial_Statement__c>();
        for (Financial_Statement__c statement : existingStatements) {
            yearToStatementMap.put(statement.Annee__c, statement);
        }

        // Prepare statements to insert or update
        List<Financial_Statement__c> statementsToUpdate = new List<Financial_Statement__c>();
        List<Financial_Statement__c> statementsToInsert = new List<Financial_Statement__c>();

        for (Map<String, Object> yearData : financialData) {
            String year = String.valueOf(yearData.get('annee'));
            Financial_Statement__c statement;

            if (yearToStatementMap.containsKey(year)) {
                // Update existing statement
                statement = yearToStatementMap.get(year);
            } else {
                // Create a new statement
                statement = new Financial_Statement__c();
                statement.Account__c = accountId;
            }

            // Map fields from financial data
            statement.Annee__c = year;
            statement.Name = year;

            // Safely map all numeric fields
            statement.chiffre_affaires__c = toDecimal(yearData.get('chiffre_affaires'));
            statement.Marge_brute__c = toDecimal(yearData.get('marge_brute'));
            statement.EBITDA_EBE__c = toDecimal(yearData.get('ebitda'));
            statement.Resultat_dexploitation__c = toDecimal(yearData.get('resultat_exploitation'));
            statement.Resultat_net__c = toDecimal(yearData.get('resultat_net'));
            statement.Taux_de_croissance_du_CA__c = toDecimal(yearData.get('taux_croissance_ca'));
            statement.Taux_de_marge_brute__c = toDecimal(yearData.get('taux_marge_brute'));
            statement.Taux_de_marge_dEBITDA__c = toDecimal(yearData.get('taux_marge_ebitda'));
            statement.Taux_de_marge_oprationnelle__c = toDecimal(yearData.get('taux_marge_operationnelle'));
            statement.BFR__c = toDecimal(yearData.get('bfr'));
            statement.BFR_exploitation__c = toDecimal(yearData.get('bfr_exploitation'));
            statement.BFR_hors_exploitation__c = toDecimal(yearData.get('bfr_hors_exploitation'));
            statement.BFR_j_de_CA__c = toDecimal(yearData.get('BFR_jours_CA'));
            statement.Capacite_dautofinancement__c = toDecimal(yearData.get('capacite_autofinancement'));
            statement.Fonds_de_roulement_net_global__c = toDecimal(yearData.get('fonds_roulement_net_global'));
            statement.Trsorerie__c = toDecimal(yearData.get('tresorerie'));
            statement.Dettes_financires__c = toDecimal(yearData.get('dettes_financieres'));
            statement.Capacit_de_remboursement__c = toDecimal(yearData.get('capacite_remboursement'));
            statement.Ratio_dendettement_Gearing__c = toDecimal(yearData.get('ratio_endettement'));
            statement.Autonomie_financiere__c = toDecimal(yearData.get('autonomie_financiere'));
            statement.tat_des_dettes_1_an_au_plus__c = toDecimal(yearData.get('etat_dettes_1_an_au_plus'));
            statement.Liquidit_generale__c = toDecimal(yearData.get('liquidite_generale'));
            statement.Couverture_des_dettes__c = toDecimal(yearData.get('couverture_dettes'));
            statement.Fonds_propres__c = toDecimal(yearData.get('fonds_propres'));
            statement.Marge_nette__c = toDecimal(yearData.get('marge_nette'));
            statement.Rentabilit_sur_fonds_propres__c = toDecimal(yearData.get('rentabilite_fonds_propres'));
            statement.Rentabilite_economique__c = toDecimal(yearData.get('rentabilite_economique'));
            statement.Valeur_ajoutee__c = toDecimal(yearData.get('valeur_ajoutee'));
            statement.Salaires_et_charges_sociales__c = toDecimal(yearData.get('salaires_charges_sociales'));
            statement.Salaires_CA__c = toDecimal(yearData.get('salaires_CA'));
            statement.Impots_et_taxes__c = toDecimal(yearData.get('impots_taxes'));

            if (yearToStatementMap.containsKey(year)) {
                statementsToUpdate.add(statement);
            } else {
                statementsToInsert.add(statement);
            }
        }

        // Perform DML operations
        if (!statementsToInsert.isEmpty()) {
            insert statementsToInsert;
        }
        if (!statementsToUpdate.isEmpty()) {
            update statementsToUpdate;
        }

        return true;
    } catch (Exception ex) {
        System.debug('Error updating financial statements: ' + ex.getMessage());
        throw new AuraHandledException('Erreur lors de la mise à jour des données financières : ' + ex.getMessage());
    }
}

// Helper Method to Safely Convert to Decimal
private static Decimal toDecimal(Object value) {
    if (value == null) return null;
    try {
        return (Decimal) value;
    } catch (Exception ex) {
        System.debug('Invalid conversion to Decimal for value: ' + value);
        return null;
    }
}


}