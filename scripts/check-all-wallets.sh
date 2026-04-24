#!/bin/bash

# Check all wallet balances
wallets=(
  "HygGrUFtmBRtHm55dm3y4i1eXTYwhoph17iQF7tj3jty:professor_oops"
  "AMo6xCoY121D43nHQ6gQV94bcBdzJE1Z8Bv53P1xEfTH:rarecandyclub"
  "8skfzAae6XpS9BSabXY7Q6YZf9scG6af7wVR1uD6seKE:rohanmaker09"
  "9m2UnDX8PumTPkVxQeJj7GHddyqd19LG2NV9RKYvRenh:spacemann"
  "C3hLfDqcVwRHPybnEWAKVKrtMzyJD5xGLWxFxQTuJcnt:tallestpythonmanny"
  "6aacdtbhBRn9dmwxQqb1Wk24cVp1KYBx5owp5xEyuqu:teamrockayeee"
  "9MABwPxLuuaYaj84jV2rSGTorSeAL3LDMeAneXaeYjNf:tkk"
  "2FS4M86kn3b6uoAsMb77G32B9eP1E4MdMPHLtFErWeKj:toast"
  "4uccovks8nyHAz7xp7gnMH9nUxHCpyMxrNbpyyZM4eCT:abc"
  "HsCgsfS1UvcX1aSwSynFoUgX47kyTa2Y3mVVfyCVnYSH:ash_ketchup"
  "Ju7gvRGH7j9DBAvgkVVCLNLgTEewbdDpRY1DEqQrGsi:bigboyblastoise"
  "AjH1BDd1WkHWjooXDsaTMZ2VvKQyXsEP4BwzMjnNS56X:bklounge69"
  "4J7XywhRaEbEaSReKrMJYPEWxJbE8iVk56FfxbVV2tdW:dadandkidsnft"
  "8e8uJKR9s4RMP4sUH1dGCwyuqh2H1PFWeVxR4YhvuDQY:emice2467_"
  "rdUHrgwRkqTAPCuhgeaEv7QyP9mjnKeDz2q4cHvTx7c:ianbarreto"
  "5KvBCG0M5JZtBjVbvY8yeAsLDf8j7TqzDjSjtDAxH5ec:jjaajjaax"
  "2XoHGfmjXnMkpGw32Lyzj1enPuVTtSgCzsfScvMncWHo:jrarena151"
  "9HFrustbKhEM486o724WmqSpXjyCvSXzcqpvhSfRmW7Z:kirbstomp"
  "HgvNrV2B9ezDeataRBNyks7CG2wQHNRvEBXa5z4q1S2f:lanceketchum"
  "BSdPGVszeAyU7KkxXvjsj2borv1fMjP28m7uBrGDrQm1:mariajaytattoo"
  "6o4xHEPjjzYXeeP55PT9fWUY15wibEePX3L5R5iaQdkv:m1dkreds"
  "Az86w3Gm9C6HZfugFQTMutiUKcs2LAogqYZbjRjE48Bm:mistyluvr"
  "H9Gu836EdgpHe571Tf8f6S8EWrNpoFXTU1q3WoXtPr9f:onlyfans"
  "DLzXmfCb2tjLCM2avbxYRRbtSEPtMVhwpkccS6A4Q44z:pokehontas"
)

echo "Checking all wallets for actual SOL balance..."
echo ""

total=0
has_balance=()

for entry in "${wallets[@]}"; do
  IFS=: read -r address username <<< "$entry"
  balance=$(node scripts/check-wallet-balance.mjs "$address" 2>/dev/null | grep "Balance:" | awk '{print $2}')
  
  if [ ! -z "$balance" ] && [ "$balance" != "0" ]; then
    echo "✅ $username: $balance SOL ($address)"
    has_balance+=("$username: $balance SOL")
    total=$(echo "$total + $balance" | bc)
  fi
done

echo ""
echo "================================"
if [ ${#has_balance[@]} -eq 0 ]; then
  echo "❌ NO WALLETS HAVE ANY SOL"
else
  echo "Wallets with balance:"
  printf '%s\n' "${has_balance[@]}"
  echo ""
  echo "Total SOL across all wallets: $total SOL"
fi
echo "================================"
