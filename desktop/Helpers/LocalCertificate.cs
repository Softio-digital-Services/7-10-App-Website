using System;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace InventorySystem.Helpers
{
    /// <summary>
    /// Self-signed certificate for the local HTTPS listener, created once per install.
    /// The private key never ships with the app: it is generated on first run and kept in
    /// %LocalAppData%\SevenTenInventory\Certificates, with its password protected by DPAPI (current user).
    /// </summary>
    public static class LocalCertificate
    {
        private static string Folder => Path.Combine(DatabaseConfig.UserDataDirectory, "Certificates");
        private static string PfxPath => Path.Combine(Folder, "pos_cert.pfx");
        private static string PasswordPath => Path.Combine(Folder, "pos_cert.key");

        /// <summary>Returns the install's certificate, creating it on first use. Null if it cannot be made.</summary>
        public static X509Certificate2 Load()
        {
            try
            {
                if (File.Exists(PfxPath) && File.Exists(PasswordPath))
                {
                    var existing = new X509Certificate2(PfxPath, ReadPassword(), X509KeyStorageFlags.UserKeySet);
                    if (existing.NotAfter > DateTime.Now.AddDays(30)) return existing;
                }
                return Create();
            }
            catch (Exception ex)
            {
                ErrorLogger.LogError(ex, "LocalCertificate.Load");
                return null;
            }
        }

        private static X509Certificate2 Create()
        {
            Directory.CreateDirectory(Folder);
            using RSA rsa = RSA.Create(2048);
            var request = new CertificateRequest("CN=SevenTen POS (local)", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

            var san = new SubjectAlternativeNameBuilder();
            san.AddDnsName("localhost");
            san.AddDnsName(Environment.MachineName);
            san.AddIpAddress(IPAddress.Loopback);
            foreach (IPAddress ip in Dns.GetHostAddresses(Dns.GetHostName()))
            {
                if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork) san.AddIpAddress(ip);
            }
            request.CertificateExtensions.Add(san.Build());
            request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, false));
            request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, false));
            request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection { new Oid("1.3.6.1.5.5.7.3.1") }, false));

            using X509Certificate2 cert = request.CreateSelfSigned(DateTimeOffset.Now.AddDays(-1), DateTimeOffset.Now.AddYears(2));
            string password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            File.WriteAllBytes(PfxPath, cert.Export(X509ContentType.Pfx, password));
            byte[] protectedPassword = ProtectedData.Protect(System.Text.Encoding.UTF8.GetBytes(password), null, DataProtectionScope.CurrentUser);
            File.WriteAllBytes(PasswordPath, protectedPassword);

            return new X509Certificate2(PfxPath, password, X509KeyStorageFlags.UserKeySet);
        }

        private static string ReadPassword()
        {
            byte[] data = ProtectedData.Unprotect(File.ReadAllBytes(PasswordPath), null, DataProtectionScope.CurrentUser);
            return System.Text.Encoding.UTF8.GetString(data);
        }
    }
}
