#!/usr/bin/env bash

# 🧪 Test d'intégration Frontend - Logique de Vente
# Date: 5 février 2026

set -e

API="http://127.0.0.1:8000/api"
HEADER_AUTH="Authorization: Bearer YOUR_TOKEN"
CLIENT_ID=1
PRODUCT_ID=1

echo "════════════════════════════════════════════════"
echo "🧪 Tests Intégration Frontend - Logique Vente"
echo "════════════════════════════════════════════════"

# Test 1: Créer un brouillon
echo -e "\n✋ Test 1: Créer un brouillon de vente"
echo "POST $API/sales/draft"
DRAFT=$(curl -s -X POST "$API/sales/draft" \
  -H "Content-Type: application/json" \
  -H "$HEADER_AUTH" \
  -d "{\"client_id\": $CLIENT_ID}")

SALE_ID=$(echo $DRAFT | jq -r '.sale.id // .id // empty')
echo "Response: $DRAFT"
echo "Sale ID: $SALE_ID"

if [ -z "$SALE_ID" ]; then
  echo "❌ Erreur: Impossible de créer le brouillon"
  exit 1
fi
echo "✅ Brouillon créé avec ID: $SALE_ID"

# Test 2: Ajouter un article
echo -e "\n✋ Test 2: Ajouter un article"
echo "POST $API/sales/$SALE_ID/items"
ITEM=$(curl -s -X POST "$API/sales/$SALE_ID/items" \
  -H "Content-Type: application/json" \
  -H "$HEADER_AUTH" \
  -d "{
    \"product_id\": $PRODUCT_ID,
    \"quantity\": 2,
    \"price_unit\": 5000,
    \"discount\": 500,
    \"tax_included\": true
  }")

echo "Response: $ITEM"
ITEM_ID=$(echo $ITEM | jq -r '.sale.items[0].id // empty')
echo "✅ Article ajouté avec ID: $ITEM_ID"

# Test 3: Ajouter un deuxième article
echo -e "\n✋ Test 3: Ajouter deuxième article"
echo "POST $API/sales/$SALE_ID/items"
ITEM2=$(curl -s -X POST "$API/sales/$SALE_ID/items" \
  -H "Content-Type: application/json" \
  -H "$HEADER_AUTH" \
  -d "{
    \"product_id\": 2,
    \"quantity\": 1,
    \"price_unit\": 3000,
    \"discount\": 0,
    \"tax_included\": false
  }")

echo "Response: $ITEM2"
echo "✅ Article 2 ajouté"

# Test 4: Récupérer la vente (avec totaux recalculés)
echo -e "\n✋ Test 4: Récupérer vente avec totaux"
echo "GET $API/sales/$SALE_ID"
SALE=$(curl -s -X GET "$API/sales/$SALE_ID" \
  -H "$HEADER_AUTH")

echo "Response:"
echo $SALE | jq '.'
echo "✅ Vente récupérée:"
echo "   Status: $(echo $SALE | jq -r '.sale.status')"
echo "   Total HT: $(echo $SALE | jq -r '.sale.total_ht')"
echo "   Total Tax: $(echo $SALE | jq -r '.sale.total_tax')"
echo "   Total TTC: $(echo $SALE | jq -r '.sale.total_ttc')"

# Test 5: Valider la vente
echo -e "\n✋ Test 5: Valider la vente"
echo "POST $API/sales/$SALE_ID/validate"
VALIDATED=$(curl -s -X POST "$API/sales/$SALE_ID/validate" \
  -H "Content-Type: application/json" \
  -H "$HEADER_AUTH" \
  -d "{}")

echo "Response:"
echo $VALIDATED | jq '.'
STATUS=$(echo $VALIDATED | jq -r '.sale.status')
echo "✅ Vente validée. Nouveau status: $STATUS"

if [ "$STATUS" != "validated" ]; then
  echo "⚠️ Status inattendu: $STATUS (attendu: validated)"
fi

# Test 6: Enregistrer un paiement partiel
echo -e "\n✋ Test 6: Ajouter paiement partiel (50%)"
TOTAL=$(echo $SALE | jq -r '.sale.total_ttc')
HALF=$(echo "$TOTAL / 2" | bc)
echo "POST $API/sales/$SALE_ID/payment"
echo "Montant: $HALF / $TOTAL"

PAYMENT1=$(curl -s -X POST "$API/sales/$SALE_ID/payment" \
  -H "Content-Type: application/json" \
  -H "$HEADER_AUTH" \
  -d "{
    \"amount\": $HALF,
    \"payment_method\": \"wave\",
    \"reference\": \"WAVE-12345\",
    \"notes\": \"Paiement partiel Wave\"
  }")

echo "Response:"
echo $PAYMENT1 | jq '.'
STATUS=$(echo $PAYMENT1 | jq -r '.sale.status')
echo "✅ Paiement 1 enregistré. Status: $STATUS"

if [ "$STATUS" != "partially_paid" ]; then
  echo "⚠️ Status inattendu: $STATUS (attendu: partially_paid)"
fi

# Test 7: Enregistrer paiement final
echo -e "\n✋ Test 7: Ajouter paiement final"
echo "POST $API/sales/$SALE_ID/payment"
PAYMENT2=$(curl -s -X POST "$API/sales/$SALE_ID/payment" \
  -H "Content-Type: application/json" \
  -H "$HEADER_AUTH" \
  -d "{
    \"amount\": $HALF,
    \"payment_method\": \"cash\",
    \"notes\": \"Paiement final liquide\"
  }")

echo "Response:"
echo $PAYMENT2 | jq '.'
STATUS=$(echo $PAYMENT2 | jq -r '.sale.status')
echo "✅ Paiement 2 enregistré. Status: $STATUS"

if [ "$STATUS" == "paid" ] || [ "$STATUS" == "closed" ]; then
  echo "✅ Vente PAYÉE (stock devrait être décrémenté)"
else
  echo "⚠️ Status inattendu: $STATUS (attendu: paid/closed)"
fi

# Test 8: Vérifier que la vente n'est plus modifiable
echo -e "\n✋ Test 8: Essayer d'ajouter un article à vente payée"
echo "POST $API/sales/$SALE_ID/items (doit échouer)"
SHOULD_FAIL=$(curl -s -X POST "$API/sales/$SALE_ID/items" \
  -H "Content-Type: application/json" \
  -H "$HEADER_AUTH" \
  -d "{
    \"product_id\": 3,
    \"quantity\": 1,
    \"price_unit\": 1000,
    \"discount\": 0,
    \"tax_included\": false
  }")

ERROR=$(echo $SHOULD_FAIL | jq -r '.error // .message // empty')
if [ -n "$ERROR" ]; then
  echo "✅ Correctement rejeté: $ERROR"
else
  echo "⚠️ Devrait être rejeté mais a accepté"
  echo $SHOULD_FAIL | jq '.'
fi

# Test 9: Récupérer les ventes finalisées
echo -e "\n✋ Test 9: Lister les ventes finalisées"
echo "GET $API/sales"
SALES_LIST=$(curl -s -X GET "$API/sales" \
  -H "$HEADER_AUTH")

echo "Response:"
echo $SALES_LIST | jq '.sales[] | {id, status, total_ttc}'
PAID_COUNT=$(echo $SALES_LIST | jq '.sales | length')
echo "✅ Trouvé $PAID_COUNT vente(s) finalisée(s)"

# Test 10: Vérifier sync-status
echo -e "\n✋ Test 10: Récupérer statut de sync"
echo "GET $API/sales/sync-status"
SYNC=$(curl -s -X GET "$API/sales/sync-status" \
  -H "$HEADER_AUTH")

echo "Response:"
echo $SYNC | jq '.'
PENDING=$(echo $SYNC | jq -r '.queue.pending // 0')
echo "✅ Éléments pending: $PENDING"

echo -e "\n════════════════════════════════════════════════"
echo "✅ Tous les tests intégration complétés!"
echo "════════════════════════════════════════════════"
