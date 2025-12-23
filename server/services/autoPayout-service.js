const mongoose = require('mongoose');
const ProviderEarning = require('../models/ProviderEarning-model');
const PaymentRecord = require('../models/PaymentRecord-model');
const Provider = require('../models/Provider-model');
const sendEmail = require('../utils/sendEmail');

/**
 * Auto payout service for providers
 * Runs daily at 2 AM to process payouts for earnings older than 7 days
 */
const autoPayout = async () => {
  console.log('Starting auto payout process...');

  const session = await mongoose.startSession();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Step 1: Find eligible ProviderEarning records
    const eligibleEarnings = await ProviderEarning.find({
      createdAt: { $lte: sevenDaysAgo },
      isVisibleToProvider: true,
      paymentRecord: { $exists: false }
    }).populate('provider', 'name email bankDetails').session(session);

    if (eligibleEarnings.length === 0) {
      console.log('No eligible earnings found for auto payout.');
      return;
    }

    // Step 2: Group earnings by provider
    const earningsByProvider = {};
    eligibleEarnings.forEach(earning => {
      const providerId = earning.provider._id.toString();
      if (!earningsByProvider[providerId]) {
        earningsByProvider[providerId] = {
          provider: earning.provider,
          earnings: [],
          totalAmount: 0
        };
      }
      earningsByProvider[providerId].earnings.push(earning);
      earningsByProvider[providerId].totalAmount += earning.netAmount;
    });

    // Step 3: Process payouts for each provider
    for (const [providerId, data] of Object.entries(earningsByProvider)) {
      const { provider, earnings, totalAmount } = data;

      // Skip if total payout < ₹500
      if (totalAmount < 500) {
        console.log(`Skipping provider ${provider.name} (${providerId}): Total amount ₹${totalAmount} < ₹500`);
        continue;
      }

      // Check bank details
      if (!provider.bankDetails || !provider.bankDetails.accountNo || !provider.bankDetails.verified) {
        console.log(`Skipping provider ${provider.name} (${providerId}): Bank details missing or not verified`);
        continue;
      }

      try {
        await session.withTransaction(async () => {
          // Create PaymentRecord
          const paymentRecord = new PaymentRecord({
            provider: providerId,
            amount: totalAmount,
            netAmount: totalAmount,
            paymentMethod: 'bank_transfer',
            paymentDetails: {
              accountNumber: provider.bankDetails.accountNo,
              accountName: provider.bankDetails.accountName,
              ifscCode: provider.bankDetails.ifsc,
              bankName: provider.bankDetails.bankName
            },
            status: 'processing',
            withdrawalType: 'auto',
            notes: 'Auto payout after 7 days'
          });

          await paymentRecord.save({ session });

          // Link earnings to payment record
          await ProviderEarning.updateMany(
            { _id: { $in: earnings.map(e => e._id) } },
            { paymentRecord: paymentRecord._id },
            { session }
          );

          console.log(`Auto payout created for provider ${provider.name} (${providerId}): ₹${totalAmount}, PaymentRecord ID: ${paymentRecord._id}`);

          // Send email notification
          try {
            const emailHtml = `
              <h3>Auto Payout Initiated ✅</h3>
              <p>Dear ${provider.name},</p>
              <p>Your auto payout has been initiated for earnings older than 7 days.</p>
              <p><strong>Amount:</strong> ₹${totalAmount}</p>
              <p><strong>Payment Method:</strong> Bank Transfer</p>
              <p><strong>Bank Account:</strong> ${provider.bankDetails.accountName} (${provider.bankDetails.accountNo})</p>
              <p><strong>Status:</strong> Processing</p>
              <p><strong>Notes:</strong> Auto payout after 7 days</p>
              <br/>
              <p>You will receive a confirmation once the payout is completed.</p>
              <br/>
              <p>Regards,</p>
              <p><b>Raj Electrical Service</b></p>
            `;

            await sendEmail({
              to: provider.email,
              subject: 'Auto Payout Initiated - Raj Electrical Service',
              html: emailHtml
            });

            console.log(`Email sent to provider ${provider.name} (${provider.email})`);
          } catch (emailError) {
            console.error(`Failed to send email to provider ${provider.name}:`, emailError);
          }
        });
      } catch (transactionError) {
        console.error(`Transaction failed for provider ${provider.name} (${providerId}):`, transactionError);
        // Continue to next provider
      }
    }

    console.log('Auto payout process completed successfully.');
  } catch (error) {
    console.error('Auto payout error:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};

module.exports = { autoPayout };
