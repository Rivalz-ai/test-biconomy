import { createMeeClient, toNexusAccount, createBicoPaymasterClient,    SmartSessionMode,
    toSmartSessionsModule,
    toMultichainNexusAccount,
    MEEVersion,
    getMEEVersion,
    meeSessionActions,
    getSudoPolicy
 } from "@biconomy/abstractjs";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { http, parseEther, formatEther, createPublicClient, createWalletClient, encodeFunctionData, getAddress,  type Hex ,erc20Abi, parseUnits, toFunctionSelector, getAbiItem} from "viem";
import { config } from "dotenv";


config();
//EOA wallet
//wallet address: 0x9d2e4E6657210f1cD8ddF2aB1B7F8011C58A2B75
const privateKey = "0x87b95223e9f45b73cc1bd2c01e16e0d92f228e289ea6d3089e99a0d3685d68d2"; 
/// DAPP_PRIVATE_KEY
const sinnerSessionKey="0x309bf357d110280e4c0807f4bbddebb455ae4540de1c482f67fc818eb1cee22e"
//const daap_wallet_address_from_private_key="0x96beB6427454BEd99c20179f24a7d0894A3Ad5BD"
//
//const bundlerUrl = "https://bundler.biconomy.io/api/v3/84532/bundler_3ZUi4xvBRNjyHvWWPFpb83A9";
//const paymasterUrl = "https://paymaster.biconomy.io/api/v2/84532/9YTUGYitn.73ea1313-001c-4382-bf9b-8bb2f1f92b2a";
// USDC contract address on Base Sepolia (alternative address)
const USDC_ADDRESS = getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e");


export const smartSession = async () => {
    //owner 
    const ownerAccount= privateKeyToAccount(privateKey);
    const sessionSigner = privateKeyToAccount(sinnerSessionKey as Hex)
    //
    const ssValidator = toSmartSessionsModule({
        signer: sessionSigner
    })
      
    const orchestrator = await toMultichainNexusAccount({
        chainConfigurations: [
          {
            chain: baseSepolia,
            transport: http(),
            version: getMEEVersion(MEEVersion.V2_1_0)
          }
        ],
        signer: ownerAccount
      })
      
    // The execution is done through the Modular Execution Environment.
    // This cretes a connection to the Biconomy MEE Relayers.
    const meeClient = await createMeeClient({ account: orchestrator })
    
    // This extends the `meeClient` object with additional methods which 
    // are used to work with Smart Sessions.
    const sessionsMeeClient = meeClient.extend(meeSessionActions)
    //
    const payload = await sessionsMeeClient.prepareForPermissions({
        smartSessionsValidator: ssValidator,
        feeToken: {
          address: USDC_ADDRESS,
          chainId: baseSepolia.id
        },
        trigger: {
          tokenAddress: USDC_ADDRESS,
          chainId: baseSepolia.id,
          amount: parseUnits('10', 6)
        }
    })
    let sessionDetails;
    if (payload) {
        const receipt = await meeClient.waitForSupertransactionReceipt({ hash: payload.hash })
        //
        sessionDetails = await sessionsMeeClient.grantPermissionTypedDataSign({
            redeemer: sessionSigner.address,
            feeToken: {
              address: USDC_ADDRESS,
              chainId: baseSepolia.id
            },
            actions: [
              {
                chainId: baseSepolia.id, // chain where permission is granted
                actionTarget: USDC_ADDRESS, // contract that contains an allowed method
                actionTargetSelector: toFunctionSelector(getAbiItem({ abi: erc20Abi, name: "approve" })), // an allowed method selector
                actionPolicies: [getSudoPolicy()] // Policy to apply
              }
            ],
            maxPaymentAmount: parseUnits('2', 6)
          })
        //
    } else {
        sessionDetails = await sessionsMeeClient.grantPermissionTypedDataSign({
            redeemer: sessionSigner.address,
            feeToken: {
              address: USDC_ADDRESS,
              chainId: baseSepolia.id
            },
            actions: [
              {
                chainId: baseSepolia.id, // chain where permission is granted
                actionTarget: USDC_ADDRESS, // contract that contains an allowed method
                actionTargetSelector: toFunctionSelector(getAbiItem({ abi: erc20Abi, name: "approve" })), // an allowed method selector
                actionPolicies: [getSudoPolicy()] // Policy to apply
              }
            ],
            maxPaymentAmount: parseUnits('2', 6)
          })
    }
    /////////////////////////////////////////////////////////
    // Execute approval
    // 
    const userOwnedOrchestratorWithSessionSigner = await toMultichainNexusAccount({
        chainConfigurations: [
              {
            chain: baseSepolia,
            transport: http(),
            version: getMEEVersion(MEEVersion.V2_1_0)
          }
        ],
        accountAddress: orchestrator.addressOn(baseSepolia.id)!,
        signer: sessionSigner
      })
      
      const sessionSignerMeeClient = await createMeeClient({
        account: userOwnedOrchestratorWithSessionSigner
      })
      
      const sessionSignerSessionMeeClient = sessionSignerMeeClient.extend(meeSessionActions)
      const executionPayload = await sessionSignerSessionMeeClient.usePermission({
        sessionDetails,
        mode: 'ENABLE_AND_USE',
        feeToken: {
          address: USDC_ADDRESS,
          chainId: baseSepolia.id
        },
        instructions: [
            {
                chainId: baseSepolia.id,
                calls: [{ to: USDC_ADDRESS, data: "0x273ea3e3" }]
            },
        ] // must match granted actions
      })
      
      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash: executionPayload.hash
      })
      console.log("executionPayload: ", executionPayload)

}


// Execute the deployment function
async function main() {

    smartSession();
   
}

main().catch(error => {
    console.error("❌ Main Error:", error);
});


