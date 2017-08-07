import React from 'react';
import { Link } from 'react-router';
import Modal from 'react-modal';
import moment from 'moment';
import AsyncButton from './common/AsyncButton';
import { VaultClient, TidePayAPI, VCUtils as Utils } from '../logics';
import UnlockButton from './common/UnlockButton';
import DropdownMenu from './common/DropdownMenu';

function TransactionHistory(props) {
  const {
    pocket,
    transactionHistory,
    onSelectTransaction,
  } = props;
  if (!pocket) {
    return (
      <div>
        No pocket selected!
      </div>
    );
  }
  if (!transactionHistory) {
    return (
      <div>
        Loading...
      </div>
    );
  }

  function convertHuman(transaction) {
    const {
      time,
      action,
      status,
      direction,
      amount,
      targetAddress,
      targetUsername,
      targetCurrency,
    } = transaction;

    const statusText = ['Processing', 'Failed', 'Success'];
    const actionText = ['Sent', 'Exchanged', 'Received'];
    const directionText = ['to', 'from'];
    const directionSign = ['-', '+'];
    const descriptionDetail = action === 0 ? targetCurrency : targetUsername || targetAddress;
    return {
      time: moment.unix(time).format('D/M/YY h:mm A'),
      descriptions: [
        actionText[action + 1] + ' ' + directionText[direction],
        descriptionDetail,
      ],
      status: statusText[status + 1],
      amount: directionSign[direction] + amount,
    };
  }

  function handleSelectTransaction(transactionID, event) {
    event.preventDefault();
    onSelectTransaction(transactionID);
  }

  const rows = transactionHistory.map((transaction) => {
    const {
      transactionID,
    } = transaction;
    const {
      time,
      descriptions,
      status,
      amount,
    } = convertHuman(transaction);
    const onClick = handleSelectTransaction.bind(this, transactionID);
    return (
      <tr key={transactionID}>
        <td>{time}</td>
        <td>{descriptions[0]}<br />{descriptions[1]}</td>
        <td>{status}</td>
        <td>{amount}</td>
        <td>
          <button onClick={onClick}>Details</button>
        </td>
      </tr>
    );
  });

  if (rows.length === 0) {
    return (
      <div>
        No history!
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <td width="200">Date</td>
          <td width="350">Description</td>
          <td width="100">Status</td>
          <td width="100">Amount</td>
          <td width="100">&nbsp;</td>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

function TransactionModal(props) {
  const {
    selectedTransaction,
    transactionDetails,
    onClose,
  } = props;

  if (!selectedTransaction) {
    return null;
  }

  let content;
  if (transactionDetails) {
    const {
      transactionID,
      ...rest
    } = transactionDetails;
    content = (
      <div>
        <h1>ID: {transactionID}</h1>
        <pre>{JSON.stringify(rest, null, 2)}</pre>
      </div>
    );
  } else {
    content = (
      <div>
        <p>Loading...</p>
      </div>
    );
  }

  const handleClose = (event) => {
    event.preventDefault();
    onClose();
  };
  return (
    <Modal
      isOpen={!!selectedTransaction}
      contentLabel={selectedTransaction}
    >
      {content}
      <br />
      <button onClick={handleClose}>Close</button>
    </Modal>
  );
}

function WalletTable(props) {
  const { secret, pockets, selectedPocket, self } = props;
  const noSecret = !secret;

  function handleSelectPocket(pocket, event) {
    event.preventDefault();
    self.handleSelectPocket(pocket);
  }

  const rows = [];
  Object.keys(pockets).forEach((currency) => {
    const onSelectPocket = handleSelectPocket.bind(this, currency);
    const disabledSelectButton = currency === selectedPocket;
    rows.push(
      <tr key={currency}>
        <td>{currency}</td>
        <td>{pockets[currency]}</td>
        <td>
          <AsyncButton
            type="button"
            disabled={noSecret}
            onClick={self.handleFreezePocket}
            pendingText="Freezing..."
            fulFilledText="Frozen"
            rejectedText="Failed! Try Again"
            text="Freeze"
            eventValue={currency}
          />
        </td>
        <td>
          <button disabled={disabledSelectButton} onClick={onSelectPocket}>See history</button>
        </td>
      </tr>
    );
  });

  if (rows.length === 0) {
    return (
      <div>
        No pocket!
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <td>Currency</td>
          <td>Top Up Address</td>
          <td>Freeze</td>
          <td>&nbsp;</td>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

function AddWalletForm(props) {
  const {
    secret,
    self,
  } = props;

  if (!secret) {
    return null;
  }

  const currencies = self.state.supportedCurrencies.filter(currency => self.state.pockets[currency] === undefined);

  return (
    <form>
      <div>
        Activate pocket:
        <DropdownMenu items={currencies} onChange={self.handleNewPocketCurrencyChange} />
        <AsyncButton
          type="button"
          onClick={self.handleActivatePocket}
          pendingText="Activating..."
          fulFilledText="Activated"
          rejectedText="Failed! Try Again"
          text="Activate"
        />
      </div>
    </form>
  );
}

export default class WalletPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      public: null,
      secret: null,
      hasPaymentPin: null,
      unlockSecret: null,
      pockets: {},
      newPocketCurrency: '',
      supportedCurrencies: [],
      selectedPocket: null,
      transactionHistory: null,
      selectedTransaction: null,
      transactionDetails: null,
    };
    this.handleActivatePocket = this.handleActivatePocket.bind(this);
    this.handleFreezePocket = this.handleFreezePocket.bind(this);
    this.handleSelectPocket = this.handleSelectPocket.bind(this);
    this.onUnlock = this.onUnlock.bind(this);
    this.handleNewPocketCurrencyChange = this.handleNewPocketCurrencyChange.bind(this);
    this.handleSelectTransaction = this.handleSelectTransaction.bind(this);
    this.handleTransactionModalClose = this.handleTransactionModalClose.bind(this);
  }

  componentDidMount() {
    const setResults = ([loginInfo, pockets, supported]) => {
      const { blob } = loginInfo;
      const address = blob.data.account_id;
      this.setState({
        public: address,
        hasPaymentPin: blob.has_payment_pin,
        unlockSecret: blob.data.unlock_secret,
        supportedCurrencies: supported.currencies,
        pockets,
      });
    };
    const getPockets = (loginInfo) => {
      const { blob } = loginInfo;
      const address = blob.data.account_id;
      return TidePayAPI.getAccountPockets(address);
    };
    const loginInfoPromise = VaultClient.getLoginInfo()
      .catch((err) => {
        console.error('getLoginInfo', err);
        return Promise.reject(err);
      });
    const pocketsPromise = loginInfoPromise.then(getPockets)
      .catch((err) => {
        console.error('Get pockets', err);
        return Promise.reject(err);
      });
    const supportedCurrenciesPromise = TidePayAPI.getCurrencies()
      .catch((err) => {
        console.error('Get supported currencies', err);
        return Promise.reject(err);
      });
    const promise = Promise.all([
      loginInfoPromise,
      pocketsPromise,
      supportedCurrenciesPromise,
    ]);
    this.cancelablePromise = Utils.makeCancelable(promise);
    this.cancelablePromise.promise
      .then(setResults)
      .catch((err) => {
        if (!(err instanceof Error) && err.isCanceled) {
          return;
        }
        alert('Failed to get pockets / supported currencies');
      });
  }

  componentWillUnmount() {
    this.cancelablePromise.cancel();
  }

  handleNewPocketCurrencyChange(currency) {
    this.setState({ newPocketCurrency: currency });
  }

  handleActivatePocket(event) {
    console.log('Handle activate pocket');

    return TidePayAPI.getGatewayAddress()
      .then((value) => {
        const gatewayAddress = value.gateway;
        const sourceAccount = {
          address: this.state.public,
          secret: this.state.secret,
        };
        const currency = this.state.newPocketCurrency;

        console.log('sourceAccount', sourceAccount);
        console.log('gateway', gatewayAddress);
        console.log('currency', currency);
        // return Promise.resolve({ currency, coinAddress: 'hahaha' });
        return TidePayAPI.setPocket(sourceAccount, currency);
      })
      .then((result) => {
        console.log('activate pocket', result);
        const pockets = {
          ...this.state.pockets,
          [result.currency]: result.coinAddress,
        };
        this.setState({ pockets });
        alert('Pocket activated!');
        return Promise.resolve();
      }).catch(err => {
        console.error('activate pocket:', err);
        alert('Failed to activate pocket: ' + err.message);
        return Promise.reject(err);
      });
  }

  handleFreezePocket(value) {
    const currency = value;
    console.log('Handle freeze pocket', currency);

    return TidePayAPI.getGatewayAddress()
      .then((value) => {
        const gatewayAddress = value.gateway;
        const sourceAccount = {
          address: this.state.public,
          secret: this.state.secret,
        };

        console.log('sourceAccount', sourceAccount);
        console.log('gateway', gatewayAddress);
        console.log('currency', currency);
        return TidePayAPI.setPocket(sourceAccount, currency, true);
      })
      .then((result) => {
        console.log('freeze pocket', result);
        const pockets = {
          ...this.state.pockets,
        };
        delete pockets[currency];
        this.setState({ pockets });
        alert('Pocket frozen!');
        return Promise.resolve();
      }).catch(err => {
        console.error('freeze pocket:', err);
        alert('Failed to freeze pocket: ' + err.message);
        return Promise.reject(err);
      });
  }

  handleSelectPocket(pocket) {
    this.setState({
      selectedPocket: pocket,
      transactionHistory: null,
      transactionDetails: null,
    });

    if (this.cancelablePromise) {
      this.cancelablePromise.cancel();
    }
    const gatewayAddressPromise = TidePayAPI.getGatewayAddress();
    const accountTransactionsPromise = gatewayAddressPromise
      .then((value) => {
        const options = {
          currency: pocket,
          limit: 10,
          counterparty: value.gateway,
        };
        return TidePayAPI.getAccountTransactions(this.state.public, options);
      });
    const promise = accountTransactionsPromise;
    this.cancelablePromise = Utils.makeCancelable(promise);
    this.cancelablePromise.promise
      .then((resp) => {
        const { result } = resp;
        const { transactions } = result;
        this.setState({
          transactionHistory: transactions,
        });
      });
  }

  handleSelectTransaction(transactionID) {
    if (this.cancelablePromise) {
      this.cancelablePromise.cancel();
    }
    const { transactionDetails } = this.state;
    if (transactionDetails && transactionDetails.transactionID === transactionID) {
      this.setState({
        selectedTransaction: transactionID,
      });
      return;
    }

    this.setState({
      selectedTransaction: transactionID,
      transactionDetails: null,
    });
    const {
      public: address,
      selectedPocket: currency,
    } = this.state;
    const gatewayAddressPromise = TidePayAPI.getGatewayAddress();
    const transactionDetailPromise = gatewayAddressPromise
      .then((value) => {
        const options = {
          address,
          currency,
          counterparty: value.gateway,
        };
        return TidePayAPI.getTransactionDetail(transactionID, options);
      });
    const promise = transactionDetailPromise;
    this.cancelablePromise = Utils.makeCancelable(promise);
    this.cancelablePromise.promise
      .then((resp) => {
        const { transaction } = resp;
        this.setState({
          transactionDetails: transaction,
        });
      });
  }

  handleTransactionModalClose() {
    this.setState({
      selectedTransaction: null,
    });
  }

  onUnlock(secret) {
    this.setState({ secret });
  }

  render() {
    let childComponents = null;
    if (this.state.public) {
      childComponents = (
        <div>
          <UnlockButton address={this.state.public} secret={this.state.secret} hasPaymentPin={this.state.hasPaymentPin} unlockSecret={this.state.unlockSecret} onUnlock={this.onUnlock} />
          <br />
          <AddWalletForm secret={this.state.secret} self={this} />
          <br />
          <h2>Pockets</h2>
          <WalletTable pockets={this.state.pockets} secret={this.state.secret} selectedPocket={this.state.selectedPocket} self={this} />
          <br />
          <h2>Transaction History</h2>
          <TransactionHistory
            pocket={this.state.selectedPocket}
            transactionHistory={this.state.transactionHistory}
            onSelectTransaction={this.handleSelectTransaction}
          />
          <TransactionModal
            selectedTransaction={this.state.selectedTransaction}
            transactionDetails={this.state.transactionDetails}
            onClose={this.handleTransactionModalClose}
          />
        </div>
      );
    }
    return (
      <div className="home">
        <h1>Wallet</h1>
        {childComponents}
        <br />
        <Link to="/main">Back to main page</Link>
      </div>
    );
  }
}
