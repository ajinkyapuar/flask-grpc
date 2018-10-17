window.user_account =  document.getElementById("user_address").textContent;
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
        if(receipt["blockNumber"] !== null) {
            // Transaction went through
            if (cb) {
                cb(receipt);
            }
        } else {
            window.setTimeout(function () {
                waitForReceipt(hash, cb);
            }, 1000);
        }
    } else {
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

const approveTokens = (contract) => {
    return new Promise((resolve, reject) => {
        contract.approve(
            window.jobAddress,
            parseInt(window.jobPrice),
            {from: window.user_account},
            (error, hash) => {
                if (!error) {
                    console.log('Approving Job...');
                    console.dir(hash);
                    resolve(hash);
                }
                else {
                    console.log(error);
                    document.getElementById("fundJob").textContent = "Rejected";
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
            window.user_account =  document.getElementById("user_address").textContent;
        });
    });
};

isMainNetwork()
    .then(() => {
        document.getElementById("fundJob").disabled = true;
        document.getElementById("fundJob").textContent = "Please, wait...";
        console.log("jobAddress: ", window.jobAddress);
        console.log("jobPrice: ", window.jobPrice);
        console.log("user_account: ", window.user_account);
        if (window.user_account.includes("MetaMask")){
            document.getElementById("approveTokens").value = "MetaMask Disabled!";
            window.user_account =  document.getElementById("user_address").value;
            console.log("user_account: ", window.user_account);
        } else return approveTokens(window.token_contract);
    })
    .then((hash) => {
        console.log("hash: ", hash);
        return waitForReceipt(hash, function (receipt) {
            console.log(receipt);
            console.log("blockNumber: ", receipt["blockNumber"]);
            console.log("transactionHash: ", receipt["transactionHash"]);
            window.blockNumber = receipt["blockNumber"];
            window.transactionHash = receipt["transactionHash"];
            $.post( "/get_receipt", { receipt });
        });
    })
    .then((receipt) => {
        return waitForEvent(window.token_contract, function (eventResult) {
            console.log("[approveTokens] eventResult:", eventResult);
            var last_event = eventResult[eventResult.length-1];
            if(last_event) {
                if(window.transactionHash === last_event["transactionHash"]) {
                    window.consumer = last_event["args"]["spender"];
                    console.log("consumer: ", window.consumer);
                    window.owner = last_event["args"]["owner"];
                    console.log("jobAddress: ", window.jobAddress);
                    window.jobPrice = last_event["args"]["value"]["c"][0];
                    console.log("jobPrice: ", window.jobPrice);
                    document.getElementById("fundJob").textContent = "FundJob";
                    document.getElementById("fundJob").disabled = false;
                    $.post("/get_events", {
                        blockNumber: window.blockNumber,
                        transactionHash: window.transactionHash,
                        consumer: window.consumer,
                        jobAddress: window.jobAddress,
                        jobPrice: window.jobPrice
                    });
                }
            }
            else {
                document.getElementById("fundJob").textContent = "JobFail!";
            }
        });
    })
    .catch(console.error);