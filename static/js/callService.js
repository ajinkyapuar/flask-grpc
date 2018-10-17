var Eth = window.Eth;
var md5 = window.md5;

window.jobAddress = $(".jobAddress").text();
window.jobPrice = $(".jobPrice").text();
window.job_contract = window.web3.eth.contract(jobAbi).at(window.jobAddress);
window.token_contract = window.web3.eth.contract(tokenAbi).at('0x3b226ff6aad7851d3263e53cb7688d13a07f6e81');
window.tokenAddress = "0x3b226ff6aad7851d3263e53cb7688d13a07f6e81";
window.receipt = null;
window.blockNumber = 'latest';
window.transactionHash = "";
window.consumer = "";

function waitForReceipt(hash, cb) {
  window.web3.eth.getTransactionReceipt(hash, function (err, receipt) {
    if (err) {
      error(err);
    }
    if (receipt !== null) {
      // Transaction went through
      if (cb) {
        cb(receipt);
      }
    } else {
      // Try again in 1 second
      window.setTimeout(function () {
        waitForReceipt(hash, cb);
      }, 1000);
    }
  });
}

function waitForEvent(contract, cb){
    if(window.blockNumber === null) window.blockNumber = 'latest';
    var event = contract.Approval({}, { fromBlock: window.blockNumber, toBlock: 'latest' }).get((err, eventResult) => {
        if (err) {
          console.log(err);
        }
        if (eventResult !== null && eventResult.length > 0)
        {
            if (cb) {
                cb(eventResult);
            }
        } else {
            setTimeout(function () {
                waitForEvent(contract, cb);
            }, 1000);
        }
    });
}

const getCode = (contract) => {
    return new Promise((resolve, reject) => {
        contract.approve(
            window.jobAddress,
            parseInt(window.jobPrice),
            {from: window.user_account},
            (error, hash) => {
                if (!error) {
                    console.log('Transaction sent');
                    console.dir(hash);
                    resolve(hash);
                }
                else {
                    console.log(error);
                    reject(error);
                }
            }
        );
    });
};

const isMainNetwork = () => {
    return new Promise((resolve, reject) => {
        window.web3.version.getNetwork((err, netId) => {
            if (err) {
                reject(err);
                return;
            }
            netId === '42' ? resolve() : reject('not kovan network');
        });
    });
};

isMainNetwork()
    .then(() => {
        console.log("jobAddress: ", window.jobAddress);
        console.log("jobPrice: ", window.jobPrice);
        window.job_state = -1;
        window.job_contract.state({from: window.user_account},
            function (error, jobState) {
                if (!error) {
                    window.jobState = jobState;
                    console.log("jobState: ", window.jobState);
                } else console.log("Error jobState: ", error);

            }
        );
    })
    .then((state) => {
        console.log("jobState: ", state);
    })
    .then(() => {
        document.getElementById("getResponse").disabled = true;
        document.getElementById("getResponse").textContent = "Please, wait...";
        console.log("jobAddress: ", window.jobAddress);
        console.log("jobPrice: ", window.jobPrice);
        window.user_account =  document.getElementById("user_address").textContent;
        console.log("user_account: ", window.user_account);
        window.agent_address =  document.getElementById("agent_address").value;
        console.log("agent_address: ", window.agent_address);
        window.agent = window.web3.eth.contract(agentAbi).at(window.agent_address);

        const oldSigAgentBytecodeChecksum = "f4b0a8064a38abaf2630f5f6bd0043c8";
        let addressBytes = [];
        for(let i=2; i< window.jobAddress.length-1; i+=2) {
          addressBytes.push(parseInt(window.jobAddress.substr(i, 2), 16));
        }

        window.web3.eth.getCode(window.agent.address,
            function(error, bytecode) {
                if (!error) {
                    let bcBytes = [];
                    for (let i = 2; i < bytecode.length; i += 2) {
                        bcBytes.push(parseInt(bytecode.substr(i, 2), 16));
                    }
                    let bcSum = md5(bcBytes);
                    let sigPayload = bcSum === oldSigAgentBytecodeChecksum ? Eth.keccak256(addressBytes) : Eth.fromUtf8(window.jobAddress);

                    console.log("jobState: ", window.jobState);
                    console.log("user_account: ", window.user_account);
                    console.log("sigPayload: ", sigPayload);
                    //var eth_sign = new Eth(window.web3.currentProvider);
                    //eth_sign.personal_sign(sigPayload, window.user_account,
                    window.web3.personal.sign(sigPayload, window.user_account,
                        function (error, signature) {
                            if (!error) {
                                let r = `0x${signature.slice(2, 66)}`;
                                let s = `0x${signature.slice(66, 130)}`;
                                let v = parseInt(signature.slice(130, 132), 16);

                                window.agent.validateJobInvocation(window.jobAddress, v, r, s, {from: window.user_account},
                                    function (error, validateJob) {
                                        if (!error) {
                                            console.log('validateJobInvocation: ' + validateJob);
                                            // If agent is using old bytecode, put auth in params object. Otherwise, put auth in headers as new daemon
                                            // must be in use to support new signature scheme
                                            let callHeaders = bcSum === oldSigAgentBytecodeChecksum ? {} : {
                                                "snet-job-address": window.jobAddress,
                                                "snet-job-signature": signature
                                            };

                                            let addlParams = bcSum === oldSigAgentBytecodeChecksum ? {
                                                job_address: window.jobAddress,
                                                job_signature: signature
                                            } : {};

                                            console.log("callHeaders: ", callHeaders);
                                            console.log("addlParams: ", addlParams);
                                            console.log("SIGNATURE: ", signature);

                                            $.post("/get_signature", {
                                                job_address: window.jobAddress,
                                                job_signature: signature
                                            });

                                            document.getElementById("getResponse").disabled = false;
                                            if(validateJob) document.getElementById("getResponse").textContent = "GetResponse";
                                            else document.getElementById("getResponse").textContent = "JobFail";
                                        } else {
                                            document.getElementById("getResponse").textContent = "JobFail";
                                            console.log("Error validateJobInvocation: ", error);
                                        }
                                    });
                            } else console.log("Error personal_sign: ", error);
                        });
                } else console.log("Error getCode: ", error);
            });
    })
    .catch(console.error);