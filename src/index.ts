import { createMeeClient, toNexusAccount, createBicoPaymasterClient,    SmartSessionMode,
    toSmartSessionsModule,
    toMultichainNexusAccount,
    MEEVersion,
    getMEEVersion,
    meeSessionActions,
    getSudoPolicy,
 } from "@biconomy/abstractjs";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { base } from "viem/chains";
import { http, parseEther, formatEther, createPublicClient, createWalletClient, encodeFunctionData, getAddress,  type Hex ,erc20Abi, parseUnits, toFunctionSelector, getAbiItem} from "viem";
import { config } from "dotenv";


config();
//EOA wallet
//wallet address: 0x2627E1959137aF743beA8A1d77b8d6F02b1e297a
const privateKey = "0x04a15097c1e0deb75b50128e2cd353f34bff69c81be5686f4646c496b981c754"; 
/// DAPP_PRIVATE_KEY
const sinnerSessionKey="0xdd894acfaadf257b51bc4e098ce7de9c1c25e1d16a2126a5d7ab8ae718df58e2"
//const daap_wallet_address_from_private_key="0xC439fef012BA8812764Fd00456f593F8d2a286D0"
const BASE_RPC_URL          = "https://wider-indulgent-lake.base-mainnet.quiknode.pro/70c485c14aaebe34529ba660416d8cc00814a68c"
//const bundlerUrl = "https://bundler.biconomy.io/api/v3/84532/bundler_3ZUi4xvBRNjyHvWWPFpb83A9";
//const paymasterUrl = "https://paymaster.biconomy.io/api/v2/84532/9YTUGYitn.73ea1313-001c-4382-bf9b-8bb2f1f92b2a";
// USDC contract address on Base Sepolia (alternative address)
//const USDC_ADDRESS = getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e"); testnet
const USDC_ADDRESS = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"); //mainnet


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
            chain: base,
            transport: http(BASE_RPC_URL),
            version: getMEEVersion(MEEVersion.V2_1_0)
          }
        ],
        signer: ownerAccount
      })
    console.log("done orchestrator")  
    // The execution is done through the Modular Execution Environment.
    // This cretes a connection to the Biconomy MEE Relayers.
    const meeClient = await createMeeClient({ 
      account: orchestrator,
      //url: "https://staging-network.biconomy.io/v1", // imported from sdk
      apiKey: "mee_3ZR41sgh3c2ih53RYXbDSEwJ" 
    })
    console.log("done createMeeClient")
    // This extends the `meeClient` object with additional methods which 
    // are used to work with Smart Sessions.
    const sessionsMeeClient = meeClient.extend(meeSessionActions)
    //
    console.log("done meeClient.extend")
    const payload = await sessionsMeeClient.prepareForPermissions({
        smartSessionsValidator: ssValidator,
        feeToken: {
          address: USDC_ADDRESS,
          chainId: base.id
        },
        trigger: {
          tokenAddress: USDC_ADDRESS,
          chainId: base.id,
          amount: parseUnits('10', 6)
        }
    })
    console.log("done prepareForPermissions")
    console.log("prepareForPermissions payload: ", payload)
    let sessionDetails;
    if (payload) {
        console.log("wait for supertransactionReceipt")
        const receipt = await meeClient.waitForSupertransactionReceipt({ hash: payload.hash })
        //
        console.log("receipt: ", receipt)
        sessionDetails = await sessionsMeeClient.grantPermissionTypedDataSign({
            redeemer: sessionSigner.address,
            feeToken: {
              address: USDC_ADDRESS,
              chainId: base.id
            },
            actions: [
              {
                chainId: base.id, // chain where permission is granted
                actionTarget: USDC_ADDRESS, // contract that contains an allowed method
                actionTargetSelector: toFunctionSelector(getAbiItem({ abi: erc20Abi, name: "transfer" })), // an allowed method selector
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
              chainId: base.id
            },
            actions: [
              {
                chainId: base.id, // chain where permission is granted
                actionTarget: USDC_ADDRESS, // contract that contains an allowed method
                actionTargetSelector: toFunctionSelector(getAbiItem({ abi: erc20Abi, name: "transfer" })), // an allowed method selector
                actionPolicies: [getSudoPolicy()] // Policy to apply
              }
            ],
            maxPaymentAmount: parseUnits('2', 6)
          })
    }
    console.log("done grant")
    /////////////////////////////////////////////////////////
    // Execute transfer
    // 
    const userOwnedOrchestratorWithSessionSigner = await toMultichainNexusAccount({
        chainConfigurations: [
              {
            chain: base,
            transport: http(BASE_RPC_URL),
            version: getMEEVersion(MEEVersion.V2_1_0)
          }
        ],
        accountAddress: orchestrator.addressOn(base.id)!,
        signer: sessionSigner
      })
      
      const sessionSignerMeeClient = await createMeeClient({
        account: userOwnedOrchestratorWithSessionSigner
      })

      //
      const sessionSignerSessionMeeClient = sessionSignerMeeClient.extend(meeSessionActions)
      const executionPayload = await sessionSignerSessionMeeClient.usePermission({
        sessionDetails,
        mode: 'ENABLE_AND_USE',
        feeToken: {
          address: USDC_ADDRESS,
          chainId: base.id
        },
        instructions: [
            {
                chainId: base.id,
                calls: [{  
                  to: USDC_ADDRESS,
                  data: encodeFunctionData({
                      abi: erc20Abi,
                      functionName: "transfer",
                      args: ["0xC0fcFAd6a5db86F566102B8a7115823068a93c50", parseUnits("1", 6)]
                  })
                }]
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


