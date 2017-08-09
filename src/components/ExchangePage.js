import React from 'react';
import { Link } from 'react-router';
import Modal from 'react-modal';
import moment from 'moment';
import AsyncButton from './common/AsyncButton';
import { VaultClient, TidePayAPI, VCUtils as Utils } from '../logics';
import UnlockButton from './common/UnlockButton';
import DropdownMenu from './common/DropdownMenu';
import AccountBalanceTable from './common/AccountBalanceTable';

function TransactionHistory(props) {
  const {
    exchangeHistory,
    onSelectExchange,
  } = props;

  if (!exchangeHistory) {
    return (
      <div>
        Loading...
      </div>
    );
  }

  function convertHuman(transaction) {
    const {
      time,
      status,
      currency,
      amount,
      targetCurrency,
      targetAmount,
    } = transaction;

    const statusText = ['Processing', 'Failed', 'Success'];
    return {
      time: moment.unix(time).format('D/M/YY h:mm A'),
      descriptions: [
        `From ${amount}${currency}`,
        `To ${targetAmount}${targetCurrency}`,
      ],
      status: statusText[status + 1],
    };
  }

  function handleSelectExchange(transactionID, event) {
    event.preventDefault();
    onSelectExchange(transactionID);
  }

  const rows = exchangeHistory.map((transaction) => {
    const {
      transactionID,
    } = transaction;
    const {
      time,
      descriptions,
      status,
    } = convertHuman(transaction);
    const onClick = handleSelectExchange.bind(this, transactionID);
    return (
      <tr key={transactionID}>
        <td>{time}</td>
        <td>{descriptions[0]}<br />{descriptions[1]}</td>
        <td>{status}</td>
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
          <td width="100">&nbsp;</td>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

function TransactionModal(props) {
  const {
    selectedExchange,
    exchangeDetails,
    onClose,
  } = props;

  if (!selectedExchange) {
    return null;
  }

  let content;
  if (exchangeDetails) {
    const {
      transactionID,
      ...rest
    } = exchangeDetails;
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
      isOpen={!!selectedExchange}
      contentLabel={selectedExchange}
    >
      {content}
      <br />
      <button onClick={handleClose}>Close</button>
    </Modal>
  );
}

function ExchangeRateForm(props) {
  const {
    secret,
    self,
    baseCurrency,
    currencies,
    supportedPairs,
  } = props;

  if (!secret) {
    return null;
  }

  function filterCurrency(currency) {
    return supportedPairs[baseCurrency].includes(currency);
  }
  const symbols = baseCurrency ? currencies.filter(filterCurrency) : [];

  return (
    <form>
      <h1>Exchange Rate</h1>
      <div>
        From:
        <DropdownMenu items={currencies} onChange={self.handleCurrencyChange.bind(self, 'baseCurrency')} />
      </div>
      <div>
        To:
        <DropdownMenu items={symbols} onChange={self.handleCurrencyChange.bind(self, 'symbolCurrency')} />
      </div>
      <AsyncButton
        type="button"
        onClick={self.handleSubmitExchangeRateForm}
        pendingText="Sending..."
        fulFilledText="Sent"
        rejectedText="Failed! Try Again"
        text="Send"
      />
    </form>
  );
}

function ExchangeForm(props) {
  const {
    secret,
    self,
  } = props;

  if (!secret) {
    return null;
  }

  if (!self.state.exchangeRate) {
    return null;
  }

  const {
    exchangeRate,
    exchangeFromCurrency,
    exchangeFromValue,
    exchangeToCurrency,
    note,
  } = self.state;

  const exchangeToValue = parseFloat(exchangeFromValue) * exchangeRate;

  return (
    <div>
      <h1>Exchange</h1>
      <form>
        <div>
          Rate: 1 {exchangeFromCurrency} = {exchangeRate} {exchangeToCurrency}
        </div>
        <div>
          From:
          <input type="text" value={exchangeFromValue} onChange={self.handleChange.bind(self, 'exchangeFromValue')} />
          {exchangeFromCurrency}
        </div>
        <div>
          To: {exchangeToValue} {exchangeToCurrency}
        </div>
        <div>
          Note:
          <textarea value={note} onChange={self.handleChange.bind(self, 'note')} />
        </div>
        <AsyncButton
          type="button"
          onClick={self.handleSubmitExchangeForm}
          pendingText="Sending..."
          fulFilledText="Sent"
          rejectedText="Failed! Try Again"
          text="Send"
        />
      </form>
    </div>
  );
}

export default class ExchangePage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      public: null,
      secret: null,
      hasPaymentPin: null,
      unlockSecret: null,
      balances: {},
      baseCurrency: '',
      symbolCurrency: '',
      exchangeFromCurrency: '',
      exchangeFromValue: '',
      exchangeToCurrency: '',
      exchangeRate: null,
      note: '',
      supportedExchangePairs: {},
      exchangeHistory: null,
      selectedExchange: null,
      exchangeDetails: null,
    };
    this.handleCurrencyChange = this.handleCurrencyChange.bind(this);
    this.handleSubmitExchangeRateForm = this.handleSubmitExchangeRateForm.bind(this);
    this.handleSubmitExchangeForm = this.handleSubmitExchangeForm.bind(this);
    this.onUnlock = this.onUnlock.bind(this);
    this.onGetAccountBalances = this.onGetAccountBalances.bind(this);
    this.handleSelectExchange = this.handleSelectExchange.bind(this);
    this.handleExchangeModalClose = this.handleExchangeModalClose.bind(this);
  }

  componentDidMount() {
    const setResults = ([loginInfo, exchangePairs]) => {
      const { blob } = loginInfo;
      const { account_id } = blob.data;
      this.setState({
        public: account_id,
        hasPaymentPin: blob.has_payment_pin,
        unlockSecret: blob.data.unlock_secret,
        supportedExchangePairs: exchangePairs,
      });
      
      // load exchange history
      const gatewayAddressPromise = TidePayAPI.getGatewayAddress();
      const accountExchangesPromise = gatewayAddressPromise
        .then((value) => {
          const options = {
            limit: 10,
            counterparty: value.gateway,
          };
          return TidePayAPI.getAccountExchanges(account_id, options);
        });
      const promise = accountExchangesPromise;
      this.cancelablePromise = Utils.makeCancelable(promise);
      this.cancelablePromise.promise
        .then((resp) => {
          const { result } = resp;
          const { transactions } = result;
          this.setState({
            exchangeHistory: transactions,
          });
        });
    };
    const loginInfoPromise = VaultClient.getLoginInfo()
      .catch((err) => {
        console.error('getLoginInfo', err);
        return Promise.reject(err);
      });
    const exchangePairsPromise = TidePayAPI.getExchangePairs()
      .catch((err) => {
        console.error('getExchangePairs', err);
        return Promise.reject(err);
      });
    const promise = Promise.all([
      loginInfoPromise,
      exchangePairsPromise,
    ]);
    this.cancelablePromise = Utils.makeCancelable(promise);
    this.cancelablePromise.promise
      .then(setResults)
      .catch((err) => {
        if (!(err instanceof Error) && err.isCanceled) {
          return;
        }
        alert('Failed to get account balances / supported exchange pairs');
      });
  }

  componentWillUnmount() {
    this.cancelablePromise.cancel();
  }

  onUnlock(secret) {
    this.setState({ secret });
  }

  onGetAccountBalances(balances) {
    this.setState({ balances });
  }

  handleSubmitExchangeRateForm() {
    console.log('Handle exchange rate');
    const {
      baseCurrency,
      symbolCurrency,
    } = this.state;

    if (!baseCurrency || !symbolCurrency) {
      return Promise.reject(new Error('Invalid currency'));
    }

    return TidePayAPI.getRealTimeExchangeRate(baseCurrency, symbolCurrency)
      .then((result) => {
        this.setState({
          exchangeRate: result.rate,
          exchangeFromCurrency: baseCurrency,
          exchangeToCurrency: symbolCurrency,
        });
        console.log('Exchange rate:', result);
        alert('Success!');
        return Promise.resolve();
      })
      .catch((err) => {
        console.error('Exchange rate:', err);
        alert('Failed!' + err.message);
        return Promise.reject(err);
      });
  }

  handleSubmitExchangeForm() {
    console.log('Handle exchange');

    if (!this.state.exchangeRate) {
      return Promise.reject(new Error('Invalid operation'));
    }

    return TidePayAPI.getGatewayAddress()
      .then((value) => {
        const gatewayAddress = value.gateway;
        const account = {
          address: this.state.public,
          secret: this.state.secret,
        };
        const {
          exchangeFromCurrency: fromCurrency,
          exchangeFromValue: fromValue,
          exchangeToCurrency: toCurrency,
          exchangeRate,
          note: clientMemo,
        } = this.state;
        return TidePayAPI.exchangeCurrency(gatewayAddress, account, fromCurrency, fromValue, toCurrency, exchangeRate, clientMemo);
      })
      .then((result) => {
        console.log('Exchange currency:', result);
        alert('Success!');
        return Promise.resolve();
      })
      .catch((err) => {
        console.error('Exchange currency:', err);
        alert('Failed!' + err.message);
        return Promise.reject(err);
      });
  }

  handleChange(name, event) {
    this.setState({ [name]: event.target.value });
  }

  handleCurrencyChange(name, currency) {
    this.setState({ [name]: currency });
  }

  handleSelectExchange(transactionID) {
    if (this.cancelablePromise) {
      this.cancelablePromise.cancel();
    }
    const { exchangeDetails } = this.state;
    if (exchangeDetails && exchangeDetails.transactionID === transactionID) {
      this.setState({
        selectedExchange: transactionID,
      });
      return;
    }

    this.setState({
      selectedExchange: transactionID,
      exchangeDetails: null,
    });
    const {
      public: address,
    } = this.state;
    const gatewayAddressPromise = TidePayAPI.getGatewayAddress();
    const transactionDetailPromise = gatewayAddressPromise
      .then((value) => {
        const options = {
          address,
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
          exchangeDetails: transaction,
        });
      });
  }

  handleExchangeModalClose() {
    this.setState({
      selectedExchange: null,
    });
  }

  render() {
    let childComponents = null;
    if (this.state.public) {
      const currencies = Object.keys(this.state.balances);
      childComponents = (
        <div>
          <UnlockButton address={this.state.public} secret={this.state.secret} hasPaymentPin={this.state.hasPaymentPin} unlockSecret={this.state.unlockSecret} onUnlock={this.onUnlock} />
          <br />
          <AccountBalanceTable address={this.state.public} onGetAccountBalances={this.onGetAccountBalances} />
          <br />
          <h2>Transaction History</h2>
          <TransactionHistory
            exchangeHistory={this.state.exchangeHistory}
            onSelectExchange={this.handleSelectExchange}
          />
          <TransactionModal
            selectedExchange={this.state.selectedExchange}
            exchangeDetails={this.state.exchangeDetails}
            onClose={this.handleExchangeModalClose}
          />
          <br />
          <ExchangeRateForm secret={this.state.secret} self={this} baseCurrency={this.state.baseCurrency} supportedPairs={this.state.supportedExchangePairs} currencies={currencies} />
          <br />
          <ExchangeForm secret={this.state.secret} self={this} exchangeRateMap={this.state.exchangeRateMap} balances={this.state.balances} />
        </div>
      );
    }
    return (
      <div className="home">
        <h1>Ripple Account Info</h1>
        {childComponents}
        <br />
        <Link to="/main">Back to main page</Link>
      </div>
    );
  }
}
