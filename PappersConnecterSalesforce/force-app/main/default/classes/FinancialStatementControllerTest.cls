@isTest
public class FinancialStatementControllerTest {

    @testSetup
    static void setupTestData() {
        // Création d'un compte de test
        Account testAccount = new Account(Name = 'Test Account', SIREN__c = '123456789');
        insert testAccount;

        // Création d'enregistrements Financial_Statement__c associés au compte
        Financial_Statement__c statement1 = new Financial_Statement__c(
            Account__c = testAccount.Id,
            Name='2021',
            Annee__c = '2021',
            chiffre_affaires__c = 1000000,
            Marge_brute__c = 500000,
            EBITDA_EBE__c = 200000
        );

        Financial_Statement__c statement2 = new Financial_Statement__c(
            Account__c = testAccount.Id,
            Name='2022',
            Annee__c = '2022',
            chiffre_affaires__c = 1200000,
            Marge_brute__c = 600000,
            EBITDA_EBE__c = 250000
        );

        insert new List<Financial_Statement__c>{statement1, statement2};
    }

    @isTest
    static void testGetFinancialStatements() {
        // Récupération du compte de test
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];

        // Appel de la méthode
        List<Financial_Statement__c> financialStatements = FinancialStatementController.getFinancialStatements(testAccount.Id);

        // Vérifications
       // System.assertNotNull(financialStatements, 'La liste des états financiers ne doit pas être null');
        System.assertEquals(2, financialStatements.size(), 'La liste des états financiers doit contenir 2 enregistrements');

        // Vérification des valeurs des enregistrements
        System.assertEquals('2021', financialStatements[0].Annee__c, 'La première année doit être 2021');
        System.assertEquals(1000000, financialStatements[0].chiffre_affaires__c, 'Le chiffre d\'affaires pour 2021 doit correspondre');
        System.assertEquals('2022', financialStatements[1].Annee__c, 'La deuxième année doit être 2022');
        System.assertEquals(1200000, financialStatements[1].chiffre_affaires__c, 'Le chiffre d\'affaires pour 2022 doit correspondre');
    }

    @isTest
    static void testGetFinancialStatementsNoData() {
        // Création d'un compte sans états financiers
        Account noFinancialDataAccount = new Account(Name = 'No Financial Data Account', SIREN__c = '987654321');
        insert noFinancialDataAccount;

        // Appel de la méthode
        List<Financial_Statement__c> financialStatements = FinancialStatementController.getFinancialStatements(noFinancialDataAccount.Id);

        // Vérifications
       // System.assertNotNull(financialStatements, 'La liste des états financiers ne doit pas être null');
        System.assertEquals(0, financialStatements.size(), 'La liste des états financiers doit être vide');
    }
@isTest
static void testUpdateFinancialStatements() {
    // 1. Récupération du compte de test
    Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];

    // 2. Préparation des données financières à envoyer à la méthode
    List<Map<String, Object>> financialData = new List<Map<String, Object>>();

    // Mise à jour pour l'année 2021 (déjà existante)
    Map<String, Object> year2021Data = new Map<String, Object>{
        'annee' => '2021',
        'chiffre_affaires' => 1100000, // Mise à jour : nouveau chiffre d'affaires
        'marge_brute' => 550000,      // Mise à jour : nouvelle marge brute
        'ebitda' => 220000           // Mise à jour : nouvel EBITDA
    };
    financialData.add(year2021Data);

    // Ajout d'une nouvelle année (2023)
    Map<String, Object> year2023Data = new Map<String, Object>{
        'annee' => '2023',
        'chiffre_affaires' => 1300000,
        'marge_brute' => 650000,
        'ebitda' => 300000
    };
    financialData.add(year2023Data);

    // 3. Appel de la méthode à tester
    Boolean isSuccess = FinancialStatementController.updateFinancialStatements(testAccount.Id, financialData);

    // 4. Vérifications
    System.assertEquals(true, isSuccess, 'La méthode doit retourner true en cas de succès.');

    // 5. Récupération des données mises à jour pour vérification
    List<Financial_Statement__c> updatedStatements = [
        SELECT Annee__c, chiffre_affaires__c, Marge_brute__c, EBITDA_EBE__c
        FROM Financial_Statement__c
        WHERE Account__c = :testAccount.Id
        ORDER BY Annee__c ASC
    ];

    // Vérification du nombre total d'enregistrements
    System.assertEquals(3, updatedStatements.size(), 'Il doit y avoir 3 enregistrements (2021, 2022, 2023).');

    // Vérification des mises à jour pour 2021
    Financial_Statement__c statement2021 = updatedStatements[0];
    System.assertEquals('2021', statement2021.Annee__c, 'L\'année doit être 2021.');
    System.assertEquals(1100000, statement2021.chiffre_affaires__c, 'Le chiffre d\'affaires pour 2021 doit être mis à jour.');
    System.assertEquals(550000, statement2021.Marge_brute__c, 'La marge brute pour 2021 doit être mise à jour.');
    System.assertEquals(220000, statement2021.EBITDA_EBE__c, 'L\'EBITDA pour 2021 doit être mis à jour.');

    // Vérification des données existantes pour 2022 (pas mises à jour)
    Financial_Statement__c statement2022 = updatedStatements[1];
    System.assertEquals('2022', statement2022.Annee__c, 'L\'année doit être 2022.');
    System.assertEquals(1200000, statement2022.chiffre_affaires__c, 'Le chiffre d\'affaires pour 2022 doit rester inchangé.');

    // Vérification des nouvelles données pour 2023
    Financial_Statement__c statement2023 = updatedStatements[2];
    System.assertEquals('2023', statement2023.Annee__c, 'L\'année doit être 2023.');
    System.assertEquals(1300000, statement2023.chiffre_affaires__c, 'Le chiffre d\'affaires pour 2023 doit être ajouté.');
    System.assertEquals(650000, statement2023.Marge_brute__c, 'La marge brute pour 2023 doit être ajoutée.');
    System.assertEquals(300000, statement2023.EBITDA_EBE__c, 'L\'EBITDA pour 2023 doit être ajouté.');
}

}