#!/usr/bin/env ruby
# frozen_string_literal: true

require 'csv'
require 'set'
require 'net/http'
require 'uri'
require 'openssl'

# Usage: ruby scripts/check_alive_domains.rb [input_csv] [output_csv]
# Defaults: input -> assets/domain_tags_100k.csv, output -> assets/alive_domains.csv

INPUT_PATH = ARGV[0] || File.join(__dir__, '..', 'assets', 'domain_tags_100k.csv')
OUTPUT_PATH = ARGV[1] || File.join(__dir__, '..', 'assets', 'alive_domains.csv')

CHECK_TIMEOUT = 8 # seconds
FLUSH_INTERVAL = 100
USER_AGENT = 'MemorizeVaultDomainChecker/1.0 (+https://memorize.click)'
VALID_STATUS_CODES = (200..399).freeze

# Attempt to resolve whether a domain is alive by making a simple GET request to the root URL.
# We try HTTPS first, falling back to HTTP if HTTPS errors or is unreachable.
def domain_alive?(domain)
  %w[https http].each do |scheme|
    uri = URI.parse("#{scheme}://#{domain.strip}")

    begin
      Net::HTTP.start(
        uri.host,
        uri.port,
        use_ssl: uri.scheme == 'https',
        open_timeout: CHECK_TIMEOUT,
        read_timeout: CHECK_TIMEOUT,
        ssl_timeout: CHECK_TIMEOUT,
        write_timeout: CHECK_TIMEOUT,
      ) do |http|
        request = Net::HTTP::Get.new(uri)
        request['User-Agent'] = USER_AGENT
        request['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

        response = http.request(request)
        return true if VALID_STATUS_CODES.cover?(response.code.to_i)

        # Follow up to 3 redirects manually so we don't treat a 301/302 as dead
        redirect_count = 0
        current_response = response
        while current_response.is_a?(Net::HTTPRedirection) && redirect_count < 3
          redirect_uri = URI.join(uri, current_response['location'])
          redirect_request = Net::HTTP::Get.new(redirect_uri)
          redirect_request['User-Agent'] = USER_AGENT

          current_response = http.request(redirect_request)
          redirect_count += 1

          return true if VALID_STATUS_CODES.cover?(current_response.code.to_i)
        end
      end
    rescue OpenSSL::SSL::SSLError, SocketError, Timeout::Error,
           Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNREFUSED,
           Errno::EHOSTUNREACH, Errno::ECONNRESET
      # Try the next scheme or mark as dead
      next
    rescue URI::InvalidURIError
      return false
    end
  end

  false
end

unless File.exist?(INPUT_PATH)
  warn "Input file not found: #{INPUT_PATH}"
  exit 1
end

puts "Checking domains listed in #{INPUT_PATH}…"
deleted_count = 0
alive_count = 0
skipped_count = 0
processed = 0
last_flush_at = 0
seen = Set.new

def log_progress(processed:, alive:, deleted:, skipped:)
  print("\rProcessed: #{processed} | Alive: #{alive} | Dead: #{deleted} | Skipped: #{skipped}")
end

CSV.open(OUTPUT_PATH, 'w') do |csv_out|
  CSV.foreach(INPUT_PATH, headers: true).with_index(1) do |row, idx|
    csv_out << row.headers if csv_out.lineno.zero?

    domain = row['domain']&.strip
    if domain.nil? || domain.empty?
      skipped_count += 1
      processed += 1
      log_progress(processed:, alive: alive_count, deleted: deleted_count, skipped: skipped_count) if processed % 10 == 0
      next
    end

    next if seen.include?(domain)
    seen << domain

    processed += 1

    if domain_alive?(domain)
      csv_out << row
      alive_count += 1
    else
      deleted_count += 1
    end

    log_progress(processed:, alive: alive_count, deleted: deleted_count, skipped: skipped_count) if processed % 10 == 0

    if (processed - last_flush_at) >= FLUSH_INTERVAL
      csv_out.flush
      last_flush_at = processed
    end
  end
end

puts
puts 'Finished.'
puts "Alive domains written: #{alive_count}"
puts "Skipped rows without domain: #{skipped_count}"
puts "Dead domains (excluded): #{deleted_count}"
puts "Output saved to: #{OUTPUT_PATH}"
