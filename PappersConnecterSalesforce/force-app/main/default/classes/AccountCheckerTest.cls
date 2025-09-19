@isTest
public class AccountCheckerTest {
    @testSetup
    static void setupTestData() {
        // Création de données de test
        Account acc1 = new Account(Name = 'Test Account 1', SIRET__c = '12345678900000');
        Account acc2 = new Account(Name = 'Test Account 2', SIRET__c = '98765432100000');
        insert new List<Account>{acc1, acc2};
    }

    @isTest
    static void testCheckAccountsBySiret() {
        // Données d'entrée
        List<String> sirets = new List<String>{'12345678900000', '98765432100000', '11111111100000'};

        // Appel de la méthode
        Map<String, Boolean> result = AccountChecker.checkAccountsBySiret(sirets);

        // Vérifications
        System.assertEquals(3, result.size(), 'La taille de la Map devrait être 3');
        System.assertEquals(true, result.get('12345678900000'), 'Le SIRET 12345678900000 devrait être trouvé');
        System.assertEquals(true, result.get('98765432100000'), 'Le SIRET 98765432100000 devrait être trouvé');
        System.assertEquals(false, result.get('11111111100000'), 'Le SIRET 11111111100000 ne devrait pas être trouvé');
    }

    @isTest
    static void testGetAccountIdBySiret() {
        // Données d'entrée
        String existingSiret = '12345678900000';
        String nonExistingSiret = '11111111100000';

        // Appel de la méthode pour un SIRET existant
        String resultExisting = AccountChecker.getAccountIdBySiret(existingSiret);
        System.assertNotEquals(null, resultExisting, 'L\'ID d\'un compte existant ne devrait pas être null');

        // Appel de la méthode pour un SIRET inexistant
        String resultNonExisting = AccountChecker.getAccountIdBySiret(nonExistingSiret);
        System.assertEquals(null, resultNonExisting, 'L\'ID d\'un compte inexistant devrait être null');
    }

    @isTest
    static void testCreateAccountWithFinancials() {
        // Données d'entrée
        String name = 'New Test Account';
        String siret = '55555555500000';
        String siren = '555555555';
        String address = '123 Test Street, 75000, Paris, France';
        String activity = 'Retail';
        Integer employeeCount = 50;
        Boolean siege=true;
        Date creationDate = Date.today();

        List<Map<String, Object>> financialData = new List<Map<String, Object>>{
            new Map<String, Object>{
                'annee' => '2023',
                'chiffre_affaires' => 1000000,
                'marge_brute' => 500000,
                'ebitda' => 200000
            }
        };

        Map<String, Object> additionalFields = new Map<String, Object>{
            'parentId' => null,
            'formeJuridique' => 'SARL',
            'numeroTVA' => 'FR123456789',
            'scoring_financier' => new Map<String, Object>{
                'note' => 'A',
                'score' => 85.5,
                'date_calcul' => '2023-12-31'
            }
        };

        // Appel de la méthode

        Id newAccountId = AccountChecker.createAccountWithFinancials(name, siret, siren, address, siege,activity, employeeCount,  creationDate,null,null, financialData, additionalFields);

        // Vérifications
        Account createdAccount = [SELECT Name, SIRET__c, SIREN__c, BillingStreet, BillingCity, BillingCountry FROM Account WHERE Id = :newAccountId];
        System.assertEquals(name, createdAccount.Name, 'Le nom du compte doit correspondre');
        System.assertEquals(siret, createdAccount.SIRET__c, 'Le SIRET doit correspondre');
        System.assertEquals('Paris', createdAccount.BillingCity, 'La ville de l\'adresse doit correspondre');
    }

    @isTest
    static void testHandleCartographyData() {
        // Données d'entrée
      String cartographyData = '{"entreprises":[{"nom_entreprise":"Enterprise 1","siren":"111111111","id":"1"},{"nom_entreprise":"Enterprise 2","siren":"222222222","id":"2"}],"liens_entreprises_entreprises":[["1","2"]],"personnes":[{"id":"p1","prenom":"Nicolas","nom":"Thomas","niveau":1,"date_naissance":"11/1982"}],"liens_entreprises_personnes":[["1","p1"],["2","p1"]]}';

        // Création d'un compte parent
        Account parentAccount = new Account(Name = 'Parent Account', SIRET__c = '44444444400000');
        insert parentAccount;

        // Appel de la méthode
        AccountChecker.handleCartographyData(cartographyData, parentAccount.Id);

        // Vérifications
        List<Cartographie__c> cartographies = [SELECT Name, SIREN__c, Account__c FROM Cartographie__c WHERE Account__c = :parentAccount.Id];
        System.assertEquals(3, cartographies.size(), 'Il devrait y avoir 2 enregistrements de cartographie');

        List<Lien_Entreprise__c> liens = [SELECT Name, Primary_Entreprise__c, Related_Entreprise__c FROM Lien_Entreprise__c];
        System.assertEquals(3, liens.size(), 'Il devrait y avoir 1 lien entre entreprises');
    }
}